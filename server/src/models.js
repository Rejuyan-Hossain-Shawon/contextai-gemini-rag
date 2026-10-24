
import mongoose from 'mongoose';

const opts = { timestamps: true };

// ==============================
// User Model
// ==============================

export const User = mongoose.model(
  'User',
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true
      },

      email: {
        type: String,
        unique: true,
        required: true,
        lowercase: true
      },
      pendingEmail: {
  type: String,
  lowercase: true,
  trim: true,
  default: null
},

emailChangeTokenHash: {
  type: String,
  default: null
},

emailChangeTokenExpires: {
  type: Date,
  default: null
},

      passwordHash: {
        type: String,
        required: true
      },

      // Stripe customer information
      stripeCustomerId: {
        type: String,
        default: null
      },

      stripeSubscriptionId: {
        type: String,
        default: null
      },

      // Stripe subscription status
      subscriptionStatus: {
        type: String,
        enum: [
          'inactive',
          'incomplete',
          'trialing',
          'active',
          'past_due',
          'canceled',
          'unpaid',
          'incomplete_expired',
          'paused'
        ],
        default: 'inactive'
      },

      // ContextAI membership plan
      plan: {
        type: String,
        enum: ['free', 'pro'],
        default: 'free'
      },

      // Subscription expiration / renewal
      subscriptionCurrentPeriodEnd: {
        type: Date,
        default: null
      },

      // Scheduled cancellation at billing period end
      subscriptionCancelAtPeriodEnd: {
        type: Boolean,
        default: false
      },

      // Personalization preferences
      preferences: {
        theme: {
          type: String,
          enum: ['light', 'dark', 'system'],
          default: 'system'
        },

        language: {
          type: String,
          default: 'en'
        },

        responseStyle: {
          type: String,
          enum: ['concise', 'balanced', 'detailed'],
          default: 'balanced'
        },

        customInstructions: {
          type: String,
          default: '',
          maxlength: 3000
        },

        preferredModel: {
          type: String,
          default: 'default'
        }
      }
    },
    opts
  )
);

// ==============================
// Conversation Model
// ==============================

export const Conversation = mongoose.model(
  'Conversation',
  new mongoose.Schema(
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
      },

      title: {
        type: String,
        default: 'New conversation'
      },

      mode: {
        type: String,
        enum: ['general', 'document'],
        default: 'general'
      },

      documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        default: null
      }
    },
    opts
  )
);

// ==============================
// Message Model
// ==============================

export const Message = mongoose.model(
  'Message',
  new mongoose.Schema(
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },

      conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
        index: true
      },

      role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
      },

      content: {
        type: String,
        required: true
      },

      citations: [
        {
          documentId: String,
          filename: String,
          page: Number,
          chunkId: String
        }
      ]
    },
    opts
  )
);

// ==============================
// Document Model
// ==============================

export const Document = mongoose.model(
  'Document',
  new mongoose.Schema(
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
      },

      filename: String,
      mimeType: String,
      pageCount: Number,

      status: {
        type: String,
        default: 'ready'
      },

      chunkCount: Number
    },
    opts
  )
);

// ==============================
// Chunk Model
// ==============================

export const Chunk = mongoose.model(
  'Chunk',
  new mongoose.Schema(
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
      },

      documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true,
        index: true
      },

      filename: String,
      page: Number,
      text: String,
      embedding: [Number]
    },
    opts
  )
);
