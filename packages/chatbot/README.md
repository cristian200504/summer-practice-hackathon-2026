# ShowUp2Move Chatbot Microservice

A Python FastAPI microservice that provides a sports assistant chatbot using the [g4f](https://github.com/xtekky/gpt4free) library.

## Setup

```bash
cd packages/chatbot
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API

### POST /chat

Send a message and receive a sports-focused AI reply.

**Request:**
```json
{
  "message": "What's the best way to improve my tennis serve?",
  "history": [
    { "role": "user", "content": "I play tennis twice a week" },
    { "role": "assistant", "content": "That's great! Consistency is key..." }
  ]
}
```

**Response:**
```json
{
  "reply": "Focus on your toss consistency first — a reliable toss is the foundation of a great serve. Practice tossing to the same spot 50 times before adding the swing.",
  "error": null
}
```

### GET /health

Returns `{ "status": "ok" }`.

## Environment

The service runs on `http://localhost:8000` by default.
The Node.js backend proxies requests to it at `POST /chatbot`.
