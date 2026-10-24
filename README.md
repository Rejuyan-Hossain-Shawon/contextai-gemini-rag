# ContextAI — AI-Powered Chatbot with Retrieval-Augmented Generation (RAG)

**ContextAI** is a full-stack AI chatbot application built using the MERN stack, Google Gemini, and Retrieval-Augmented Generation (RAG). It allows users to interact with an AI assistant, upload PDF and TXT documents, ask questions about uploaded content, and manage their conversations through a web interface.

The project also includes user authentication, account settings, and a Stripe Sandbox subscription workflow.

## Key Features

### AI-Powered Chat
- Conversational AI powered by Google Gemini.
- Streaming AI responses for a responsive chat experience.
- General-purpose questions, explanations, and technical assistance.
- Conversation history stored in MongoDB.
- Markdown-formatted AI responses.

### Document Q&A with RAG
- Upload PDF and TXT documents.
- Extract text from supported documents.
- Split extracted text into overlapping chunks.
- Generate vector embeddings using Google's Gemini embedding model.
- Retrieve relevant chunks using cosine similarity.
- Generate document-grounded answers with source references.
- Support follow-up questions using conversation history.
- Explain technical concepts while distinguishing general knowledge from document-specific facts.

### User Authentication and Account Management
- User registration and login.
- Password hashing using bcrypt.
- JWT-based authentication.
- Profile name updates.
- Email change workflow with verification tokens.
- Secure, account-specific access to conversations and documents.

### Subscription and Billing
- Free and Pro account plans.
- Stripe Sandbox checkout integration.
- Subscription management through the Stripe Billing Portal.
- Subscription status synchronization using webhooks.
- Cancellation and reactivation support.

**Note:** Stripe is configured for testing. The application does not require real payments during development.

### User Interface
- Responsive React interface.
- Light and dark themes.
- Conversation sidebar.
- Document management.
- Account settings.
- Markdown rendering and copy-message functionality.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| AI | Google Gemini API |
| Embeddings | Gemini Embedding Model |
| RAG | Text chunking, vector embeddings, cosine similarity |
| Authentication | JWT, bcrypt |
| Document Processing | pdf-parse, Multer |
| Payments | Stripe Sandbox, Stripe Webhooks |
| Email Testing | Nodemailer, Ethereal Email |
| Security | Helmet, CORS, Express Rate Limit, Zod |

## System Architecture

```text
                User
                 |
                 v
          React Frontend
                 |
                 v
           Express API
                 |
       +---------+----------+
       |         |          |
       v         v          v
   MongoDB    Gemini API   Stripe
       |
       v
  Documents & Chunks
       |
       v
  Embedding Generation
       |
       v
  Similarity Retrieval
       |
       v
  Relevant Document Context
       |
       v
  Gemini Response Generation
       |
       v
  Streaming Answer + Citations
```

## How Retrieval-Augmented Generation Works

ContextAI uses RAG to generate answers based on uploaded documents rather than relying entirely on a language model's general knowledge.

**Step 1 — Document Upload**

Users upload PDF or TXT documents through the React interface.

**Step 2 — Text Extraction**

The backend extracts text from the uploaded document. Scanned or image-only PDFs without extractable text are not currently supported.

**Step 3 — Text Chunking**

The extracted content is divided into smaller overlapping text chunks.

**Step 4 — Embedding Generation**

Each chunk is converted into a numerical vector using the Gemini embedding model.

**Step 5 — Database Storage**

Document metadata, text chunks, and their embeddings are stored in MongoDB.

**Step 6 — Semantic Retrieval**

When a user asks a question, ContextAI generates a query embedding and compares it against stored document embeddings using cosine similarity.

The system selects the five highest-ranked chunks from the selected document.

**Step 7 — Answer Generation**

Relevant excerpts, the user's question, and recent conversation history are passed to Gemini.

**Step 8 — Response and Citations**

Gemini generates a streamed response with source references, allowing users to identify the retrieved document excerpts supporting the answer.

## Project Structure

```text
contextai/
├── client/
│   └── src/
│       ├── App.jsx
│       └── api.js
├── server/
│   └── src/
│       ├── index.js
│       ├── ai.js
│       ├── models.js
│       ├── email.js
│       ├── stripe.js
│       └── stripeWebhook.js
├── .gitignore
└── README.md
```

This structure highlights the main application files.

## Installation and Local Setup

### Prerequisites

- Node.js and npm
- MongoDB Atlas database or compatible MongoDB instance
- Google Gemini API key
- Stripe test account for billing functionality

### 1. Clone the Repository

```bash
git clone https://github.com/Rejuyan-Hossain-Shawon/contextai-gemini-rag.git
cd contextai-gemini-rag
```

### 2. Install Dependencies

Install backend dependencies:

```bash
cd server
npm install
```

Install frontend dependencies:

```bash
cd ../client
npm install
```

### 3. Configure Environment Variables

Create `server/.env` and configure the environment variables required by your local setup.

```dotenv
PORT=5000
CLIENT_URL=http://localhost:5173

MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

The billing integration also requires the appropriate Stripe test keys, webhook secret, and pricing configuration. Refer to `server/src/stripe.js` and `server/src/stripeWebhook.js` for the exact environment variable names.

Never commit real `.env` files, API keys, database passwords, or Stripe secrets to GitHub.

### 4. Start the Backend

From the `server` directory:

```bash
npm run dev
```

The API runs locally at:

`http://localhost:5000`

### 5. Start the Frontend

Open another terminal and navigate to `client`:

```bash
npm run dev
```

Open the local address displayed by Vite, normally:

`http://localhost:5173`

## Main API Functionality

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Authenticate user |
| GET | `/api/auth/me` | Retrieve account profile |
| PATCH | `/api/auth/profile` | Update profile name |
| POST | `/api/auth/email-change/request` | Request email change |
| POST | `/api/auth/email-change/confirm` | Confirm email change |
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations/:id/messages` | Retrieve conversation messages |
| DELETE | `/api/conversations/:id` | Delete conversation |
| POST | `/api/documents` | Upload document |
| GET | `/api/documents` | List documents |
| DELETE | `/api/documents/:id` | Delete document |
| POST | `/api/chat/stream` | Stream AI response |
| POST | `/api/billing/checkout` | Create Stripe checkout session |
| POST | `/api/billing/portal` | Open Stripe Billing Portal |

Protected endpoints require valid authentication.

## Security Measures

ContextAI includes:

- Password hashing using bcrypt.
- JWT authentication for protected API routes.
- Account-scoped document and conversation queries.
- Request validation using Zod.
- API rate limiting.
- Helmet HTTP security headers.
- CORS configuration.
- File-size and document-type validation.
- Hashed, expiring email-change verification tokens.
- Stripe webhook signature verification.

Additional security testing and production hardening are required before accepting public users.

## Testing

The application has been tested locally for core functionality, including authentication, profile management, document uploads, Gemini chat, and Stripe Sandbox billing.

The RAG system has been tested using a short TXT document containing known facts and a verification phrase.

Further testing should cover longer PDFs, page-level citation accuracy, retrieval relevance, and behavior when document information is missing.

## Current Limitations

- Scanned PDFs require OCR, which is not currently implemented.
- Retrieval uses cosine similarity across stored embeddings rather than a dedicated vector search index.
- Only the top five retrieved chunks are provided as document context.
- Document size and chunk-count restrictions apply.
- Email delivery uses Ethereal for development testing, not a production email provider.
- Production deployment and operational monitoring are not yet configured.
- Free and Pro plans do not yet enforce separate message or document usage limits.
- AI-generated responses may contain errors and should be checked against original sources.

## Future Improvements

- Hybrid semantic and keyword retrieval.
- Reranking for improved document relevance.
- OCR support for scanned PDFs.
- Multi-document question answering.
- Improved citation verification.
- Conversation and document search.
- Production email integration.
- Usage quotas and analytics.
- Cloud deployment with monitoring and automated tests.

## Author

**Rejuyan Hossain Shawon**

M.S. in Computer Science  
The City College of New York (CUNY)

GitHub: [Rejuyan-Hossain-Shawon](https://github.com/Rejuyan-Hossain-Shawon)

## Project Status

Core development completed. Local functional testing and portfolio preparation are in progress.

This project demonstrates full-stack application development, integration of large language models, retrieval-augmented generation, database design, authentication, and third-party API integration.
