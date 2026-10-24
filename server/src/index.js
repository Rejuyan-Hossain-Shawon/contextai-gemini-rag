
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'node:crypto';
import { sendEmailChangeVerification } from './email.js';
import multer from 'multer';
import pdf from 'pdf-parse';
import { z } from 'zod';

import {
  User,
  Conversation,
  Message,
  Document,
  Chunk
} from './models.js';

import {
  embed,
  streamAnswer,
  cosine,
  splitText
} from './ai.js';

import stripeRouter from './stripe.js';
import stripeWebhookRouter from './stripeWebhook.js';

const app = express();

app.disable('x-powered-by');

app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173'
}));

// Stripe webhooks need the original raw request body.
// This must appear BEFORE express.json().
app.use(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' })
);

// JSON parsing for normal API requests.
app.use(express.json({ limit: '1mb' }));

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  })
);

const wrap = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const auth = wrap(async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '');

  if (!token) {
    return res.status(401).json({
      error: 'Login required'
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.userId = decoded.sub;
    next();
  } catch {
    return res.status(401).json({
      error: 'Invalid session'
    });
  }
});

const validId = id => mongoose.isValidObjectId(id);

// Existing authenticated Stripe billing routes.
// The webhook route will be registered separately in the next step.
// Stripe verifies webhook signatures, so JWT authentication is not used here.
app.use('/api/billing/webhook', stripeWebhookRouter);
app.use('/api/billing', auth, stripeRouter);

app.get('/api/health', (req, res) =>
  res.json({
    ok: true,
    service: 'ContextAI'
  })
);

// -------------------------
// Authentication
// -------------------------

app.post('/api/auth/register', wrap(async (req, res) => {
  const d = z.object({
    name: z.string().trim().min(2).max(70),
    email: z.string().email().max(150),
    password: z.string().min(8).max(128)
  }).parse(req.body);

  const email = d.email.toLowerCase();

  if (await User.exists({ email })) {
    return res.status(409).json({
      error: 'Email already registered'
    });
  }

  const user = await User.create({
    name: d.name,
    email,
    passwordHash: await bcrypt.hash(d.password, 12)
  });

  const token = jwt.sign(
    { sub: String(user._id) },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const d = z.object({
    email: z.string().email(),
    password: z.string()
  }).parse(req.body);

  const user = await User.findOne({
    email: d.email.toLowerCase()
  });

  if (!user || !await bcrypt.compare(d.password, user.passwordHash)) {
    return res.status(401).json({
      error: 'Invalid email or password'
    });
  }

  const token = jwt.sign(
    { sub: String(user._id) },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  });
}));



app.get('/api/auth/me', auth, wrap(async (req, res) => {
  const u = await User.findById(req.userId)
    .select(
      'name email plan subscriptionStatus ' +
      'subscriptionCurrentPeriodEnd ' +
      'subscriptionCancelAtPeriodEnd'
    );

  if (!u) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  res.json({ user: u });
}));



app.patch('/api/auth/profile', auth, wrap(async (req, res) => {
  const d = z.object({
    name: z.string().trim().min(2).max(70)
  }).strict().parse(req.body);

  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: { name: d.name } },
    { new: true, runValidators: true }
  ).select(
    'name email plan subscriptionStatus ' +
    'subscriptionCurrentPeriodEnd ' +
    'subscriptionCancelAtPeriodEnd'
  );

  if (!user) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  res.json({
    message: 'Profile updated successfully',
    user
  });
}));



app.post('/api/auth/email-change/request', auth, wrap(async (req, res) => {
  const d = z.object({
    newEmail: z.string().trim().email().max(150),
    password: z.string().min(1)
  }).strict().parse(req.body);

  const newEmail = d.newEmail.toLowerCase();

  const user = await User.findById(req.userId);

  if (!user) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  const passwordValid = await bcrypt.compare(
    d.password,
    user.passwordHash
  );

  if (!passwordValid) {
    return res.status(401).json({
      error: 'Incorrect password'
    });
  }

  if (newEmail === user.email) {
    return res.status(400).json({
      error: 'This is already your current email'
    });
  }

  if (await User.exists({ email: newEmail })) {
    return res.status(409).json({
      error: 'Email already registered'
    });
  }

  const token = randomBytes(32).toString('hex');

  const tokenHash = createHash('sha256')
    .update(token)
    .digest('hex');

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const verificationUrl =
    `${process.env.CLIENT_URL || 'http://localhost:5173'}` +
    `/verify-email?token=${encodeURIComponent(token)}`;

  // Send first so a delivery failure does not overwrite a pending request.
  await sendEmailChangeVerification(newEmail, verificationUrl);

  user.pendingEmail = newEmail;
  user.emailChangeTokenHash = tokenHash;
  user.emailChangeTokenExpires = expiresAt;

  await user.save();

  res.json({
    message: 'Verification email sent. Check the test email preview.'
  });
}));


app.post('/api/auth/email-change/confirm', auth, wrap(async (req, res) => {
  const d = z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/)
  }).strict().parse(req.body);

  const tokenHash = createHash('sha256')
    .update(d.token)
    .digest('hex');

  const user = await User.findOne({
    _id: req.userId,
    emailChangeTokenHash: tokenHash,
    emailChangeTokenExpires: { $gt: new Date() },
    pendingEmail: { $type: 'string' }
  });

  if (!user || !user.pendingEmail) {
    return res.status(400).json({
      error: 'Invalid or expired verification link'
    });
  }

  const newEmail = user.pendingEmail;

  if (await User.exists({
    email: newEmail,
    _id: { $ne: user._id }
  })) {
    return res.status(409).json({
      error: 'Email address is already registered'
    });
  }

  // Update only when the pending token still matches.
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      emailChangeTokenHash: tokenHash,
      emailChangeTokenExpires: { $gt: new Date() },
      pendingEmail: newEmail
    },
    {
      $set: { email: newEmail },
      $unset: {
        pendingEmail: '',
        emailChangeTokenHash: '',
        emailChangeTokenExpires: ''
      }
    },
    { new: true, runValidators: true }
  ).select(
    'name email plan subscriptionStatus ' +
    'subscriptionCurrentPeriodEnd ' +
    'subscriptionCancelAtPeriodEnd'
  );

  if (!updated) {
    return res.status(400).json({
      error: 'Verification link is no longer valid'
    });
  }

  res.json({
    message: 'Email address updated successfully',
    user: updated
  });
}));


// -------------------------
// Conversations
// -------------------------

app.get('/api/conversations', auth, wrap(async (req, res) => {
  res.json(
    await Conversation.find({
      userId: req.userId
    })
      .sort({ updatedAt: -1 })
      .limit(100)
  );
}));

app.post('/api/conversations', auth, wrap(async (req, res) => {
  const d = z.object({
    title: z.string().max(100).optional(),
    mode: z.enum(['general', 'document']).optional(),
    documentId: z.string().optional()
  }).parse(req.body);

  if (
    d.mode === 'document' &&
    (
      !validId(d.documentId) ||
      !await Document.exists({
        _id: d.documentId,
        userId: req.userId
      })
    )
  ) {
    return res.status(400).json({
      error: 'Choose a valid document'
    });
  }

  res.status(201).json(
    await Conversation.create({
      userId: req.userId,
      title: d.title || 'New conversation',
      mode: d.mode || 'general',
      documentId: d.mode === 'document'
        ? d.documentId
        : null
    })
  );
}));

app.patch('/api/conversations/:id', auth, wrap(async (req, res) => {
  const d = z.object({
    title: z.string().trim().min(1).max(100)
  }).parse(req.body);

  const c = await Conversation.findOneAndUpdate(
    {
      _id: req.params.id,
      userId: req.userId
    },
    { title: d.title },
    { new: true }
  );

  if (!c) {
    return res.status(404).json({
      error: 'Not found'
    });
  }

  res.json(c);
}));

app.delete('/api/conversations/:id', auth, wrap(async (req, res) => {
  const c = await Conversation.findOneAndDelete({
    _id: req.params.id,
    userId: req.userId
  });

  if (!c) {
    return res.status(404).json({
      error: 'Not found'
    });
  }

  await Message.deleteMany({
    conversationId: c._id,
    userId: req.userId
  });

  res.json({ ok: true });
}));

app.get('/api/conversations/:id/messages', auth, wrap(async (req, res) => {
  const c = await Conversation.findOne({
    _id: req.params.id,
    userId: req.userId
  });

  if (!c) {
    return res.status(404).json({
      error: 'Not found'
    });
  }

  res.json(
    await Message.find({
      conversationId: c._id,
      userId: req.userId
    })
      .sort({ createdAt: 1 })
      .limit(100)
  );
}));

// -------------------------
// Document Uploads
// -------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (!/\.(pdf|txt)$/i.test(file.originalname)) {
      return cb(new Error('Only PDF and TXT files allowed'));
    }

    cb(null, true);
  }
});

app.post(
  '/api/documents',
  auth,
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'Choose a PDF or TXT file'
      });
    }

    const isPdf = req.file.originalname
      .toLowerCase()
      .endsWith('.pdf');

    const isTxt = req.file.originalname
      .toLowerCase()
      .endsWith('.txt');

    if (
      isPdf &&
      !req.file.buffer
        .subarray(0, 5)
        .equals(Buffer.from('%PDF-'))
    ) {
      return res.status(400).json({
        error: 'Invalid PDF file'
      });
    }

    if (isTxt && req.file.buffer.includes(0)) {
      return res.status(400).json({
        error: 'Invalid text file'
      });
    }

    let pages = [];

    
if (isPdf) {
  const extractedPages = [];

  await pdf(req.file.buffer, {
    pagerender: async page => {
      const content = await page.getTextContent();

      const text = content.items
        .map(item => item.str || '')
        .join(' ');

      extractedPages.push({
        page: page.pageNumber,
        text
      });

      return text;
    }
  });

  pages = extractedPages;
} else {
  pages = [{
    page: 1,
    text: req.file.buffer.toString('utf8')
  }];
}


    const chunks = pages.flatMap(p =>
      splitText(p.text).map(text => ({
        text,
        page: p.page
      }))
    );

    if (!chunks.length) {
      return res.status(400).json({
        error: 'No extractable text found (scanned PDFs are not supported)'
      });
    }

    if (chunks.length > 80) {
      return res.status(400).json({
        error: 'Document too long; maximum 80 text chunks'
      });
    }

    const doc = await Document.create({
      userId: req.userId,
      filename: req.file.originalname.slice(0, 180),
      mimeType: isPdf ? 'application/pdf' : 'text/plain',
      pageCount: isPdf ? null : 1,
      status: 'processing',
      chunkCount: 0
    });

    try {
      const rows = [];

      for (const c of chunks) {
        rows.push({
          userId: req.userId,
          documentId: doc._id,
          filename: doc.filename,
          page: c.page,
          text: c.text,
          embedding: await embed(c.text)
        });
      }

      await Chunk.insertMany(rows);

      doc.status = 'ready';
      doc.chunkCount = rows.length;

      await doc.save();

      res.status(201).json(doc);
    } catch (e) {
      await Chunk.deleteMany({
        documentId: doc._id
      });

      await Document.deleteOne({
        _id: doc._id
      });

      throw e;
    }
  })
);

app.get('/api/documents', auth, wrap(async (req, res) => {
  res.json(
    await Document.find({
      userId: req.userId
    })
      .sort({ createdAt: -1 })
      .select('-__v')
  );
}));

app.delete('/api/documents/:id', auth, wrap(async (req, res) => {
  const doc = await Document.findOneAndDelete({
    _id: req.params.id,
    userId: req.userId
  });

  if (!doc) {
    return res.status(404).json({
      error: 'Not found'
    });
  }

  await Chunk.deleteMany({
    documentId: doc._id,
    userId: req.userId
  });

  res.json({ ok: true });
}));

// -------------------------
// AI Chat / RAG Streaming
// -------------------------

app.post('/api/chat/stream', auth, wrap(async (req, res) => {
  const d = z.object({
    conversationId: z.string(),
    message: z.string().trim().min(1).max(4000)
  }).parse(req.body);

  const c = await Conversation.findOne({
    _id: d.conversationId,
    userId: req.userId
  });

  if (!c) {
    return res.status(404).json({
      error: 'Conversation not found'
    });
  }

  let citations = [];
  let context = '';

  if (c.mode === 'document') {
    const doc = await Document.findOne({
      _id: c.documentId,
      userId: req.userId,
      status: 'ready'
    });

    if (!doc) {
      return res.status(400).json({
        error: 'Document unavailable'
      });
    }

    
const recentUserMessages = await Message.find({
  conversationId: c._id,
  userId: req.userId,
  role: 'user'
})
  .sort({ createdAt: -1 })
  .limit(3)
  .select('content')
  .lean();

const vagueFollowUp =
  /^(give me details|more details|explain more|elaborate|tell me more|what about it|summarize it)[?.!\s]*$/i
    .test(d.message.trim());

const retrievalQuery =
  vagueFollowUp && recentUserMessages.length
    ? `${recentUserMessages[0].content}\nFollow-up: ${d.message}`
    : d.message;

const queryVector = await embed(retrievalQuery);


    const candidates = await Chunk.find({
      userId: req.userId,
      documentId: doc._id
    }).lean();

    const top = candidates
      .map(x => ({
        ...x,
        score: cosine(queryVector, x.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    citations = top.map((x, i) => ({
      documentId: String(doc._id),
      filename: doc.filename,
      page: x.page,
      chunkId: String(x._id),
      source: i + 1
    }));

    context = top.map((x, i) =>
      `[Source ${i + 1}] ${doc.filename}${x.page ? ' (page ' + x.page + ')' : ''}: ${x.text}`
    ).join('\n\n');
  }

  const previous = await Message.find({
    conversationId: c._id,
    userId: req.userId
  })
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();

  await Message.create({
    userId: req.userId,
    conversationId: c._id,
    role: 'user',
    content: d.message
  });

  if (c.title === 'New conversation') {
    c.title = d.message.slice(0, 65);
    await c.save();
  }

  res.setHeader(
    'Content-Type',
    'text/event-stream; charset=utf-8'
  );

  res.setHeader(
    'Cache-Control',
    'no-cache, no-transform'
  );

  res.setHeader('X-Accel-Buffering', 'no');

  res.flushHeaders();

  const send = (event, data) =>
    res.write(
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    );

  let output = '';

  try {
    for await (const part of streamAnswer(
      previous.reverse(),
      d.message,
      context
    )) {
      if (res.destroyed) break;

      output += part;

      send('token', {
        text: part
      });
    }

    if (output.trim()) {
      await Message.create({
        userId: req.userId,
        conversationId: c._id,
        role: 'assistant',
        content: output,
        citations
      });

      send('done', { citations });
    } else {
      send('error', {
        error: 'No response generated'
      });
    }
  } catch (e) {
    console.error('AI stream failed:', e.message);

    send('error', {
      error: 'AI request failed. Check your API key, model availability, or free-tier quota.'
    });
  }

  res.end();
}));

// -------------------------
// Global Error Handler
// -------------------------

app.use((err, req, res, next) => {
  console.error(err.message);

  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: err.issues.map(x => x.message).join(', ')
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Record already exists'
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.message
    });
  }

  res.status(500).json({
    error: err.message === 'Only PDF and TXT files allowed'
      ? err.message
      : 'Server error. Check backend logs.'
  });
});

// -------------------------
// Database and Server
// -------------------------

const port = Number(process.env.PORT) || 5000;

if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32
) {
  throw new Error(
    'JWT_SECRET must be at least 32 characters'
  );
}

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI missing');
}

await mongoose.connect(process.env.MONGODB_URI);

app.listen(port, () =>
  console.log(`ContextAI API on http://localhost:${port}`)
);
