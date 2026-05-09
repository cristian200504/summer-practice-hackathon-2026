"""
ShowUp2Move Chatbot Microservice
Uses the g4f library (GPT4Free) to provide a sports assistant chatbot.

Run with:
    python -m pip install -r requirements.txt
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ShowUp2Move Chatbot", version="1.0.0")

# Allow requests from the Node.js backend and Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are ShowUp2Move's sports assistant — a friendly, knowledgeable AI coach.
Your role is to help users with:
- Sports tips, training advice, and technique improvements
- Recommending sports based on fitness goals or interests
- Explaining rules and strategies for various sports
- Motivating users to stay active and show up to their events
- Answering questions about the ShowUp2Move platform (matching, groups, events)

Keep responses concise (2-4 sentences), energetic, and practical.
Always encourage users to stay active and connect with their sports community.
If asked about something unrelated to sports or the platform, gently redirect to sports topics."""

# ── Models ────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

class ChatResponse(BaseModel):
    reply: str
    error: Optional[str] = None

# ── g4f client setup ──────────────────────────────────────────────────────────

def _create_g4f_client():
    """
    Create a g4f AsyncClient using PollinationsAI — no API key required.
    Falls back gracefully if the import fails.
    """
    try:
        from g4f.client import AsyncClient
        from g4f.Provider import PollinationsAI
        return AsyncClient(provider=PollinationsAI)
    except Exception as e:
        logger.warning(f"g4f client init failed: {e}")
        return None

_g4f_client = _create_g4f_client()

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "chatbot"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to the sports chatbot and receive a reply.
    Maintains conversation history for context.
    """
    if _g4f_client is None:
        return ChatResponse(
            reply="I'm having a quick timeout! Try asking me again — I'm here to help with your sports questions. 🏃",
            error="g4f client not available",
        )

    try:
        # Build message list: system prompt + last 10 history messages + new user message
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        for msg in (request.history or [])[-10:]:
            messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": request.message})

        logger.info(f"Chatbot request: {request.message[:100]}...")

        # Use the async g4f client with PollinationsAI (no API key needed)
        response = await asyncio.wait_for(
            _g4f_client.chat.completions.create(
                model="openai-fast",
                messages=messages,
            ),
            timeout=25.0,
        )

        reply = response.choices[0].message.content or ""
        reply = reply.strip()

        if not reply:
            reply = "I'm here to help with your sports journey! What would you like to know?"

        logger.info(f"Chatbot reply: {reply[:100]}...")
        return ChatResponse(reply=reply)

    except asyncio.TimeoutError:
        logger.warning("Chatbot request timed out")
        return ChatResponse(
            reply="I'm having a quick timeout! Try asking me again — I'm here to help with your sports questions. 🏃",
            error="timeout",
        )
    except Exception as e:
        logger.error(f"Chatbot error: {e}")
        return ChatResponse(
            reply="I'm having a quick timeout! Try asking me again — I'm here to help with your sports questions. 🏃",
            error=str(e),
        )
