# FirstFinder

A Next.js prototype for a rare book collector assistant.

## Setup

```bash
npm install
cp .env.example .env.local
# Add your real OpenAI API key to .env.local
npm run dev
```

Then open:

```bash
http://localhost:3000
```

## How chat works

The browser calls:

```js
POST /api/chat
```

The backend route at `app/api/chat/route.js` calls the OpenAI Responses API securely on the server.
Do not put your OpenAI API key in frontend React code.
