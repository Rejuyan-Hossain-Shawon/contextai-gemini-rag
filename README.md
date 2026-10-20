# ContextAI — MERN + Google Gemini RAG Chatbot

A full-stack AI chat application with private conversations, Gemini streaming responses, PDF/TXT ingestion, semantic retrieval, and document-grounded answers.

## Stack
- React 18 + Vite, CSS, React Markdown
- Node.js, Express, MongoDB/Mongoose, JWT + bcrypt
- Google Gemini generation and Gemini embeddings
- PDF extraction with pdf-parse

## Requirements
Node.js 20.19+ (or a newer supported LTS), npm, MongoDB Atlas, Google AI Studio API key.

## Setup
1. Copy `server/.env.example` to `server/.env`, and fill in `MONGODB_URI`, `JWT_SECRET` (32+ characters), and `GEMINI_API_KEY`.
2. Optionally copy `client/.env.example` to `client/.env`.
3. From project root: `npm install`, then `npm run install:all`.
4. Start both services with `npm run dev`.
5. Open http://localhost:5173. API health: http://localhost:5000/api/health.
6. Run `npm test` for unit tests; run `npm run build --prefix client` for frontend build.

## Gemini models and costs
Defaults: `gemini-2.5-flash` and `gemini-embedding-001` with 768-dimensional embeddings. Model access, quotas, and free-tier eligibility vary. Check Google AI Studio for available models. Keep API keys on the backend only.

## How to use
- Register with email/password and log in.
- Start a general conversation; responses stream from Gemini.
- Upload a text-based PDF or TXT (5MB max, 80 chunks max). Wait for ingestion, then choose Document Q&A and select the uploaded document.
- Ask questions about the document. Answers reference retrieved snippets. The source list shows source order and filename.
- Existing conversations lock their mode/document. Click New conversation to change them.

## Architecture
Frontend -> authenticated Express REST/SSE -> MongoDB and Gemini. Uploads are parsed in memory and converted into 768-d embeddings. The app stores text chunks + embeddings in MongoDB. For a document question, the server computes query embeddings and performs cosine similarity against chunks belonging to the authenticated user and selected document. Top 5 chunks are included in the LLM prompt. This simple retrieval approach is appropriate for small demo documents; for scale, use MongoDB Atlas Vector Search or a dedicated vector DB.

## API endpoints
- POST /api/auth/register, /api/auth/login; GET /api/auth/me
- GET/POST /api/conversations; PATCH/DELETE /api/conversations/:id
- GET /api/conversations/:id/messages
- POST /api/chat/stream (Server-Sent Events)
- GET/POST /api/documents; DELETE /api/documents/:id

## Known limitations / production hardening
- PDF text extraction is currently page-agnostic; PDFs return document-level references rather than reliable page numbers. TXT uses page 1 as a placeholder. Do not claim precise PDF page citations.
- Scanned PDFs need OCR, which is not included.
- Retrieval is a linear scan of chunks; not suitable for large datasets.
- The simple JWT storage in localStorage is intended for a learning project; for production, prefer secure HttpOnly cookie sessions and CSRF protections.
- For production: enforce email verification, password reset, strict content-type checks, malware scanning, privacy/retention policy, billing controls, audit logs, streaming cancellation, and better integration testing.
- Document ingestion is synchronous and embedding calls are sequential, so large uploads can be slow.
- Provider model IDs and free-tier quotas may change; check AI Studio if an API request fails.
- LLM outputs can hallucinate. Verify sources; document instructions are untrusted.
- Hosting, MongoDB Atlas, and Gemini accounts/keys must be configured by the user. No credentials are bundled.

## Portfolio ideas
Add a short demo video, architecture diagram, and verified metrics (latency, test coverage, retrieval accuracy) only after measuring them. Explain design trade-offs in interviews.

## License
Educational portfolio starter. Review dependency licenses before redistribution.
