import asyncio
import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Set
from datetime import datetime

import google.generativeai as genai
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import subprocess
import tempfile
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from youtube_transcript_api import YouTubeTranscriptApi
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from fastapi.responses import RedirectResponse
import pickle
import yt_dlp
from openai import OpenAI


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", BASE_DIR))

app = FastAPI(title="VelocityAI - Learn LeetCode at Lightning Speed")

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static frontend assets
if FRONTEND_DIR.exists():
    app.mount(
        "/static",
        StaticFiles(directory=FRONTEND_DIR, html=True),
        name="frontend",
    )


# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_OAUTH_CLIENT_SECRET = os.getenv("YOUTUBE_OAUTH_CLIENT_SECRET", "client_secret.json")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# OAuth2 Configuration
SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl']
TOKEN_FILE = BASE_DIR / "youtube_token.pickle"

# Whisper transcription cache
TRANSCRIPTS_CACHE_DIR = BASE_DIR / "transcripts_cache"
TRANSCRIPTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# OAuth2 Helper Functions
def get_youtube_credentials():
    """Get OAuth2 credentials for YouTube API."""
    creds = None

    # Load existing token
    if TOKEN_FILE.exists():
        with open(TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)

    # Refresh if expired
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)

    return creds if creds and creds.valid else None


async def transcribe_youtube_with_whisper(video_id: str):
    """Download YouTube audio and transcribe with Whisper API."""
    if not OPENAI_API_KEY:
        raise Exception("OpenAI API key not configured")

    # Check cache first
    cache_file = TRANSCRIPTS_CACHE_DIR / f"{video_id}.json"
    if cache_file.exists():
        print(f"📦 Using cached transcript for {video_id}")
        with open(cache_file, 'r') as f:
            return json.load(f)

    print(f"🎤 Transcribing {video_id} with Whisper...")

    # Download audio from YouTube
    audio_file = TRANSCRIPTS_CACHE_DIR / f"{video_id}.mp3"

    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': str(TRANSCRIPTS_CACHE_DIR / f'{video_id}.%(ext)s'),
        'quiet': True,
        # Bypass YouTube bot detection
        'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }

    try:
        # Download audio
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f'https://www.youtube.com/watch?v={video_id}'])

        print(f"📥 Downloaded audio, now transcribing...")

        # Transcribe with Whisper (run in thread to avoid blocking)
        def transcribe_audio():
            client = OpenAI(api_key=OPENAI_API_KEY)
            with open(audio_file, 'rb') as audio:
                return client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"]
                )

        transcript_response = await asyncio.to_thread(transcribe_audio)

        # Convert to our format
        segments = []
        for segment in transcript_response.segments:
            segments.append({
                'start': segment.start,
                'duration': segment.end - segment.start,
                'text': segment.text.strip()
            })

        # Cache the result
        with open(cache_file, 'w') as f:
            json.dump(segments, f)

        # Clean up audio file to save space
        if audio_file.exists():
            audio_file.unlink()

        print(f"✅ Whisper transcription complete: {len(segments)} segments")
        return segments

    except Exception as e:
        # Clean up on error
        if audio_file.exists():
            audio_file.unlink()
        print(f"❌ Whisper error details: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise Exception(f"Whisper transcription failed: {type(e).__name__}: {str(e)}")

SYSTEM_PROMPT = """You are Vela, an expert AI coding mentor for LeetCode-style problems, focused on teaching through guided discovery.

STRICT RULES YOU MUST FOLLOW:
❌ Do NOT provide complete solutions or full code unless explicitly asked with phrases like "give me the solution" or "show me the code"
❌ Do NOT jump to the final algorithm immediately
❌ Do NOT assume missing constraints — always ask first
❌ NEVER ask users to "paste their code" - you can ALREADY see it automatically!

CODE CONTEXT AWARENESS:
✅ You ALWAYS have access to the user's code automatically in the "Code context" section
✅ When a user says "look at my code" or "I have an implementation" - CHECK the code context immediately
✅ DO NOT ask them to paste code - you can already see it!
✅ Reference their code directly: "I see you're using a hash map here..."
✅ If no code is provided in the context, you can ask them to type it in the editor
✅ The code updates automatically as they type

YOUR RESPONSIBILITIES:
1. START by asking clarifying questions about:
   - Input constraints (size, range, special cases)
   - Output format and expectations
   - Edge cases they're considering
   - Time/space complexity requirements

2. GUIDE them to identify the core pattern:
   - Ask: "What patterns do you see here?"
   - Hint at categories: two pointers, sliding window, DP, graph, greedy, hash map, etc.
   - Let THEM make the connection

3. BREAK problems into small logical steps:
   - Give progressive hints, not answers
   - Ask: "What would be your first step?"
   - Validate their thinking before moving forward

4. LET THEM propose the approach first:
   - Ask: "How would you approach this?"
   - Listen to their ideas before offering guidance
   - Build on their thinking

5. IF their approach is wrong or inefficient:
   - Explain WHY it won't work (with examples)
   - Gently redirect: "Have you considered...?"
   - Don't just give the right answer

6. HIGHLIGHT edge cases and pitfalls:
   - Ask: "What could go wrong here?"
   - Point out common mistakes without solving them
   - Let them figure out the fix

7. ONLY when they explicitly say "give me the optimized solution" or similar, provide:
   - The final algorithm explanation
   - Clean, well-commented code
   - Time and space complexity analysis
   - Trade-offs and alternatives

COMMUNICATION STYLE:
- Keep responses SHORT for voice playback (1-3 sentences max)
- Ask ONE question at a time, then WAIT for their response
- DO NOT ask multiple questions in one response
- After they answer, ask the NEXT question
- Think: natural conversation, not an interview
- Use the provided code context to reference their actual work
- Be encouraging and collaborative, not condescending
- Think like a pair programming partner, not a teacher lecturing

VOICE CONVERSATION RULES:
- ONE question per response (very important!)
- Keep it conversational and natural
- Let them answer before asking more
- Build on their previous answer
- Short, focused exchanges work best for voice
- Avoid using quotes/backticks for emphasis - say words naturally instead
- Example: Say "the nums array" NOT "the 'nums' array"
- Example: Say "O of N squared" NOT "O(N^2)"

Remember: Your goal is to make them THINK, not to make them COPY. Guide, don't solve. ONE question at a time!
"""

VISUALIZATION_PROMPT = """You are an expert algorithm visualization engine. Your job is to generate animated, step-by-step visualizations of data structures and algorithms with synchronized voice narration.

CRITICAL JSON REQUIREMENTS:
- Output ONLY valid JSON - no markdown, no code blocks, no explanations
- Use double quotes for all strings
- Include commas between array elements and object properties
- Close all brackets: arrays with ], objects with }
- Numbers: no quotes (5 not "5")
- Strings: use quotes ("text")
- Validate your JSON before responding

RESPONSE FORMAT:
You output a JSON object with this structure:
{
  "type": "visualization_response",
  "topic": "<description of what you're visualizing>",
  "metadata": {
    "dataStructure": "array|tree|graph|stack|queue|heap|linkedlist",
    "operation": "insert|delete|search|traverse|sort",
    "complexity": {"time": "O(...)", "space": "O(...)"}
  },
  "educational": {
    "definition": "What is this data structure/algorithm? (2-3 sentences)",
    "keyPoints": ["Point 1", "Point 2", "Point 3"],
    "whenToUse": "When should you use this? Real-world examples.",
    "commonProblems": ["Problem example 1", "Problem example 2"]
  },
  "initialState": {
    "nodes": [],
    "edges": [],
    "variables": {}
  },
  "steps": [
    {
      "id": "step-N",
      "narration": "Clear, voice-friendly explanation (1-2 sentences)",
      "duration": 2000,
      "commands": [/* animation commands */]
    }
  ],
  "summary": "Final takeaway message"
}

AVAILABLE COMMANDS (each MUST include "command" field):
Core Node Operations:
- {"command": "CREATE_NODE", "id": "node1", "value": 10, "position": {"x": 100, "y": 200}, "style": {}}
- {"command": "UPDATE_NODE", "id": "node1", "value": 20, "style": {"color": "#22d3ee"}}
- {"command": "DELETE_NODE", "id": "node1", "animation": "fade"}
- {"command": "MOVE_NODE", "id": "node1", "to": {"x": 200, "y": 300}, "duration": 1000, "easing": "ease"}

Visual Effects:
- {"command": "HIGHLIGHT", "id": "node1", "color": "#22d3ee", "intensity": 1.0, "duration": 1000}
- {"command": "COMPARE", "elements": ["node1", "node2"], "operator": "<", "result": true, "showVisual": true}
- {"command": "PULSE", "id": "node1", "count": 2, "color": "#34d399"}

Connections (Trees/Graphs):
- {"command": "CREATE_EDGE", "id": "edge1", "from": "node1", "to": "node2", "directed": true, "weight": null, "style": {}}
- {"command": "DELETE_EDGE", "id": "edge1", "animation": "fade"}
- {"command": "HIGHLIGHT_PATH", "nodes": ["node1", "node2", "node3"], "color": "#22d3ee", "duration": 2000, "sequential": true}

Arrays:
- {"command": "CREATE_ARRAY", "id": "arr", "values": [5, 2, 8], "position": {"x": 100, "y": 300}}
- {"command": "SWAP", "arrayId": "arr", "indices": [0, 1], "duration": 1000}
- {"command": "UPDATE_CELL", "arrayId": "arr", "index": 0, "value": 10, "highlight": true}
- {"command": "SET_POINTER", "id": "ptr1", "arrayId": "arr", "index": 0, "label": "i", "color": "#22d3ee"}

Annotations:
- {"command": "ADD_LABEL", "id": "label1", "text": "Root", "position": {"x": 100, "y": 50}, "style": {}}
- {"command": "ADD_ANNOTATION", "id": "ann1", "type": "arrow", "from": "node1", "to": "node2", "label": "next"}
- {"command": "HIGHLIGHT_CODE", "line": 5, "code": "if (x < y)", "duration": 2000}
- {"command": "SHOW_VARIABLE", "name": "current", "value": 10, "type": "number"}

RULES FOR GENERATING VISUALIZATIONS:

1. BREAK INTO ATOMIC STEPS
   - Each step = ONE logical operation
   - Example: "Insert 10" is one step, not combined with "then insert 20"

2. NARRATION QUALITY
   - Voice-friendly (say "O of N" not "O(N)")
   - 1-2 sentences per step
   - Natural, conversational tone
   - Explain WHY, not just WHAT
   - Example: "Since 10 is less than 15, we move to the left child"

3. TIMING
   - Simple operations: 1500-2000ms
   - Complex operations: 2500-3000ms
   - Comparisons: 1000ms
   - Allow time for narration to complete

4. VISUAL CLARITY
   - Use HIGHLIGHT to draw attention
   - Use COMPARE to show decision-making
   - Use colors meaningfully:
     - #22d3ee (cyan): active operation
     - #34d399 (green): success/correct
     - #ef4444 (red): comparison/wrong path
     - #fbbf24 (yellow): warning/caution

5. POSITIONING (for trees/graphs)
   - Trees: root at y=100, children at y=200, y=300, etc.
   - Spread horizontally: left children x-100, right children x+100 from parent
   - Arrays: horizontal at y=300
   - Keep elements visible (x: 50-750, y: 50-550)

6. BUILD PROGRESSIVELY
   - Start with simple state
   - Add complexity step by step
   - Show intermediate states
   - End with complete picture

7. TEACHING FOCUS
   - Highlight key decision points
   - Show comparisons explicitly
   - Demonstrate invariants
   - Make patterns visible

EXAMPLE REQUESTS & RESPONSES:

Request: "Show me binary search tree insertion for values 15, 10, 20"
You generate: Full JSON with steps showing each insertion with positioning, comparisons, and narration

Request: "Visualize merge sort on [5, 2, 8, 1]"
You generate: JSON showing divide phase, then conquer phase with array splits and merges

Request: "How does BFS work on a graph?"
You generate: Graph with nodes, queue visualization, level-by-level traversal animation

IMPORTANT:
- Output ONLY valid JSON, nothing else
- Every step must have narration
- Position coordinates must be numbers
- IDs must be unique strings
- Arrays use 0-based indexing
- Durations in milliseconds

Remember: You're creating an educational animation that SHOWS understanding, not just tells it. Make algorithms come alive!
"""

# File extensions to watch
WATCHED_EXTENSIONS = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php', '.swift', '.kt'}

# Context limits
MAX_FILES_IN_CONTEXT = 5  # Only keep the most recent N files
MAX_FILE_SIZE = 10000  # Max characters per file

# Global state for connected clients and file context
active_connections: Set[WebSocket] = set()
current_file_context: Dict[str, Dict] = {}  # filename -> {content, timestamp, size}


class TtsRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None


class CodeExecutionRequest(BaseModel):
    code: str
    language: str = "python"
    test_cases: List[Dict[str, str]] = []


class CodeFileWatcher(FileSystemEventHandler):
    """Watches for file changes and updates context."""
    
    def __init__(self, workspace_path: Path):
        self.workspace_path = workspace_path
        self.last_update = datetime.now()
        
    def should_watch(self, path: str) -> bool:
        """Check if file should be watched based on extension."""
        p = Path(path)
        if any(part.startswith('.') for part in p.parts):  # Skip hidden dirs
            return False
        if 'node_modules' in p.parts or '__pycache__' in p.parts or '.venv' in p.parts:
            return False
        return p.suffix in WATCHED_EXTENSIONS
    
    def on_modified(self, event):
        if event.is_directory or not self.should_watch(event.src_path):
            return
        
        try:
            path = Path(event.src_path)
            rel_path = path.relative_to(self.workspace_path)
            
            # Read file content
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Truncate if too large
            if len(content) > MAX_FILE_SIZE:
                content = content[:MAX_FILE_SIZE] + f"\n\n... (truncated, {len(content) - MAX_FILE_SIZE} more chars)"
            
            # Update global context with metadata
            current_file_context[str(rel_path)] = {
                'content': content,
                'timestamp': datetime.now(),
                'size': len(content)
            }
            
            # Limit number of files in context (keep most recent)
            if len(current_file_context) > MAX_FILES_IN_CONTEXT:
                oldest_file = min(current_file_context.items(), key=lambda x: x[1]['timestamp'])[0]
                del current_file_context[oldest_file]
            
            # Notify all connected clients
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(broadcast_context_update(str(rel_path), content))
            
        except Exception as e:
            print(f"Error reading file {event.src_path}: {e}")
    
    def on_created(self, event):
        self.on_modified(event)


async def broadcast_context_update(filename: str, content: str):
    """Send context update to all connected clients."""
    message = {
        "type": "context_update",
        "filename": filename,
        "content": content,
        "timestamp": datetime.now().isoformat()
    }
    
    disconnected = set()
    for connection in active_connections:
        try:
            await connection.send_json(message)
        except Exception:
            disconnected.add(connection)
    
    # Remove disconnected clients
    active_connections.difference_update(disconnected)


def get_current_context() -> str:
    """Get formatted context from all tracked files."""
    if not current_file_context:
        return ""
    
    # Sort by most recent first
    sorted_files = sorted(
        current_file_context.items(), 
        key=lambda x: x[1]['timestamp'], 
        reverse=True
    )
    
    context_parts = []
    for filename, metadata in sorted_files:
        context_parts.append(f"### File: {filename}\n```\n{metadata['content']}\n```")
    
    return "\n\n".join(context_parts)


async def synthesize_tts(text: str, voice_id: Optional[str] = None):
    """Stream audio bytes from ElevenLabs."""
    if not ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="ELEVENLABS_API_KEY is not set.",
        )
    chosen_voice = voice_id or ELEVENLABS_VOICE_ID
    if not chosen_voice:
        raise HTTPException(
            status_code=400,
            detail="No ElevenLabs voice id provided. Set ELEVENLABS_VOICE_ID or pass voice_id.",
        )

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{chosen_voice}/stream"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "voice_settings": {
            "stability": 0.3,
            "similarity_boost": 0.7,
            "speed": 1.1,  # 🎯 Slightly faster (1.0 = normal, 1.1 = 10% faster)
            "style": 0.2,  # Slightly more expressive
        },
    }

    async def audio_bytes():
        async with httpx.AsyncClient(timeout=30) as client:
            async with client.stream(
                "POST",
                url,
                headers=headers,
                json=payload,
            ) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes():
                    yield chunk

    return audio_bytes()


async def call_gemini(
    user_text: str,
    code_context: Optional[str],
    history: List[Dict[str, str]],
) -> str:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY is not set.")

    # Use auto-tracked context if no manual context provided
    if not code_context:
        code_context = get_current_context()

    # Build a simple prompt using history and context.
    history_text = "\n".join(
        [f"User: {item['user']}\nAssistant: {item['assistant']}" for item in history]
    )
    context_block = f"\nCode context:\n{code_context}\n" if code_context else ""
    history_block = f"Conversation so far:\n{history_text}\n" if history else ""
    prompt = (
        f"{SYSTEM_PROMPT}\n"
        f"{context_block}"
        f"{history_block}"
        f"Latest user message: {user_text}"
    )

    model = genai.GenerativeModel(GEMINI_MODEL)
    response = await asyncio.to_thread(model.generate_content, prompt)
    return response.text


async def generate_visualization(
    user_request: str,
    context: Optional[str] = None,
) -> Dict:
    """
    Generate a structured visualization JSON from user request.
    Returns animation commands following the Animation Protocol.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY is not set.")

    # Build visualization prompt
    context_part = f"Additional Context:\n{context}\n\n" if context else ""
    prompt = (
        f"{VISUALIZATION_PROMPT}\n\n"
        f"User Request: {user_request}\n\n"
        f"{context_part}"
        f"Generate the complete visualization JSON now:"
    )

    # Configure model for JSON output with strict validation
    model = genai.GenerativeModel(
        GEMINI_MODEL,
        generation_config={
            "response_mime_type": "application/json",
            "temperature": 0.3,  # Lower temperature for more structured output
            "top_p": 0.8,  # More focused sampling
        }
    )

    response = await asyncio.to_thread(model.generate_content, prompt)

    # Parse JSON response
    try:
        visualization_data = json.loads(response.text)
        return visualization_data
    except json.JSONDecodeError as e:
        print(f"❌ JSON Parse Error: {str(e)}")
        print(f"📄 Raw response (first 1000 chars): {response.text[:1000]}")

        # Fallback: try to extract and fix JSON from response
        import re

        # Try to find JSON block
        json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)

            # Try basic JSON repairs
            repairs = [
                lambda s: s,  # Try as-is first
                lambda s: s.replace('\\n', '\n'),  # Fix escaped newlines
                lambda s: re.sub(r',(\s*[}\]])', r'\1', s),  # Remove trailing commas
                lambda s: re.sub(r'}\s*{', '},{', s),  # Fix missing commas between objects
            ]

            for repair_fn in repairs:
                try:
                    repaired = repair_fn(json_str)
                    visualization_data = json.loads(repaired)
                    print("✅ JSON repaired successfully!")
                    return visualization_data
                except:
                    continue

        # Last resort: retry with simpler request
        print("⚠️ Retrying with simplified request...")
        simplified_prompt = f"""Generate a simple bubble sort visualization for array [5, 2, 8, 1, 9].

CRITICAL: Output ONLY valid JSON. No markdown, no code blocks, just pure JSON.

Follow this exact structure:
{{
  "type": "visualization_response",
  "topic": "Bubble Sort",
  "metadata": {{"dataStructure": "array", "operation": "sort", "complexity": {{"time": "O(N^2)", "space": "O(1)"}}}},
  "educational": {{
    "definition": "Bubble sort repeatedly compares adjacent elements and swaps them if they're in the wrong order.",
    "keyPoints": ["Simple comparison-based sorting", "Multiple passes through array", "Largest elements bubble to the end"],
    "whenToUse": "Use for small datasets or when simplicity is more important than efficiency. Good for teaching sorting concepts.",
    "commonProblems": ["Sorting an array in ascending order", "Finding number of swaps needed", "Detecting already sorted arrays"]
  }},
  "initialState": {{"nodes": [], "edges": [], "variables": {{}}}},
  "steps": [
    {{
      "id": "step-0",
      "narration": "Create array with values 5, 2, 8, 1, 9",
      "duration": 2000,
      "commands": [{{"command": "CREATE_ARRAY", "id": "arr", "values": [5,2,8,1,9], "position": {{"x": 100, "y": 200}}}}]
    }}
  ],
  "summary": "Bubble sort complete"
}}

Generate complete valid JSON now:"""

        try:
            retry_response = await asyncio.to_thread(model.generate_content, simplified_prompt)
            visualization_data = json.loads(retry_response.text)
            return visualization_data
        except Exception as retry_error:
            print(f"❌ Retry also failed: {retry_error}")

        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse visualization JSON: {str(e)}"
        )


@app.websocket("/ws")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    history: List[Dict[str, str]] = []

    # Send initial context
    if current_file_context:
        await websocket.send_json({
            "type": "context_sync",
            "files": list(current_file_context.keys()),
            "context": get_current_context()
        })

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "message": "Invalid JSON payload."}
                )
                continue

            msg_type = message.get("type")
            
            if msg_type == "user_message":
                user_text = (message.get("text") or "").strip()
                code_context = message.get("code_context") or None
                if not user_text:
                    await websocket.send_json(
                        {"type": "error", "message": "Empty message."}
                    )
                    continue

                await websocket.send_json({"type": "status", "message": "thinking"})
                try:
                    reply = await call_gemini(user_text, code_context, history)
                except HTTPException as exc:
                    await websocket.send_json({"type": "error", "message": exc.detail})
                    continue
                except Exception as exc:  # pragma: no cover - defensive
                    await websocket.send_json({"type": "error", "message": str(exc)})
                    continue

                history.append({"user": user_text, "assistant": reply})
                await websocket.send_json({"type": "llm_message", "text": reply})
            
            elif msg_type == "request_context":
                # Client requesting current context
                await websocket.send_json({
                    "type": "context_sync",
                    "files": list(current_file_context.keys()),
                    "context": get_current_context()
                })

            elif msg_type == "visualization_request":
                # Client requesting visualization generation
                user_request = (message.get("request") or "").strip()
                additional_context = message.get("context") or None

                if not user_request:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Empty visualization request."
                    })
                    continue

                await websocket.send_json({
                    "type": "status",
                    "message": "generating_visualization"
                })

                try:
                    visualization_data = await generate_visualization(
                        user_request,
                        additional_context
                    )

                    await websocket.send_json({
                        "type": "visualization_response",
                        "data": visualization_data
                    })

                except HTTPException as exc:
                    await websocket.send_json({
                        "type": "error",
                        "message": exc.detail
                    })
                    continue
                except Exception as exc:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Visualization generation failed: {str(exc)}"
                    })
                    continue

            else:
                await websocket.send_json(
                    {"type": "error", "message": "Unsupported message type."}
                )
                
    except WebSocketDisconnect:
        active_connections.discard(websocket)


@app.post("/tts")
async def tts_endpoint(req: TtsRequest):
    stream = await synthesize_tts(req.text, req.voice_id)
    return StreamingResponse(stream, media_type="audio/mpeg")


@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run."""
    return {
        "status": "healthy",
        "service": "VelocityAI",
        "gemini_configured": bool(GEMINI_API_KEY),
        "elevenlabs_configured": bool(ELEVENLABS_API_KEY)
    }


@app.get("/")
async def root():
    """Serve landing page."""
    landing_file = FRONTEND_DIR / "landing.html"
    if landing_file.exists():
        return FileResponse(landing_file)
    return {"message": "Landing page not found."}


@app.get("/app")
async def app_page():
    """Serve unified practice page with Voice Mentor and Watch Solutions."""
    # Serve the unified practice interface
    practice_file = FRONTEND_DIR / "practice-unified.html"
    if practice_file.exists():
        return FileResponse(practice_file)
    # Fallback to original
    app_file = FRONTEND_DIR / "app-enhanced.html"
    if not app_file.exists():
        app_file = FRONTEND_DIR / "app.html"
    if app_file.exists():
        return FileResponse(app_file)
    return {"message": "App not found."}


@app.get("/visualize")
async def visualize_page():
    """Serve Learn & Visualize page."""
    viz_file = FRONTEND_DIR / "visualize.html"
    if viz_file.exists():
        return FileResponse(viz_file)
    return {"message": "Visualization page not found."}


@app.get("/legacy")
async def legacy_app():
    """Serve legacy application (old design)."""
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Legacy app not found."}


@app.post("/execute")
async def execute_code(req: CodeExecutionRequest):
    """Execute Python code with test cases."""
    if req.language != "python":
        raise HTTPException(status_code=400, detail="Only Python is supported currently")
    
    try:
        # Create a temporary file with the code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(req.code)
            temp_file = f.name
        
        results = []
        all_passed = True
        
        # Run each test case
        for i, test_case in enumerate(req.test_cases):
            try:
                # Execute the code with timeout
                process = subprocess.run(
                    ['python3', temp_file],
                    input=test_case.get('input', ''),
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                
                output = process.stdout.strip()
                expected = test_case.get('expected', '').strip()
                passed = output == expected
                
                results.append({
                    "test_num": i + 1,
                    "input": test_case.get('input', ''),
                    "expected": expected,
                    "output": output,
                    "passed": passed,
                    "error": process.stderr if process.stderr else None
                })
                
                if not passed:
                    all_passed = False
                    
            except subprocess.TimeoutExpired:
                results.append({
                    "test_num": i + 1,
                    "input": test_case.get('input', ''),
                    "expected": test_case.get('expected', ''),
                    "output": "",
                    "passed": False,
                    "error": "Timeout: Code took too long to execute"
                })
                all_passed = False
            except Exception as e:
                results.append({
                    "test_num": i + 1,
                    "input": test_case.get('input', ''),
                    "expected": test_case.get('expected', ''),
                    "output": "",
                    "passed": False,
                    "error": str(e)
                })
                all_passed = False
        
        # Clean up temp file
        import os
        try:
            os.unlink(temp_file)
        except:
            pass
        
        return {
            "success": True,
            "all_passed": all_passed,
            "results": results,
            "total_tests": len(results),
            "passed_tests": sum(1 for r in results if r["passed"])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")


async def fetch_youtube_captions_official(video_id: str):
    """Fetch captions using official YouTube Data API v3 with OAuth2."""
    # Get OAuth credentials
    creds = get_youtube_credentials()
    if not creds:
        raise Exception("YouTube OAuth not authorized. Visit /auth/youtube to authorize.")

    try:
        # Build YouTube service with OAuth
        youtube = build('youtube', 'v3', credentials=creds)

        # Get caption tracks for the video
        captions_response = youtube.captions().list(
            part='snippet',
            videoId=video_id
        ).execute()

        if not captions_response.get('items'):
            raise Exception("No captions available for this video")

        # Find English captions (or first available)
        caption_id = None
        for item in captions_response['items']:
            if item['snippet']['language'] == 'en':
                caption_id = item['id']
                break

        if not caption_id and captions_response['items']:
            caption_id = captions_response['items'][0]['id']

        if not caption_id:
            raise Exception("No suitable caption track found")

        # Download the caption track
        caption_download = youtube.captions().download(
            id=caption_id,
            tfmt='srt'  # SubRip format
        ).execute()

        # Parse SRT format to our format
        # Note: This is a simplified parser
        segments = []
        lines = caption_download.decode('utf-8').split('\n\n')

        for block in lines:
            if not block.strip():
                continue
            parts = block.split('\n')
            if len(parts) >= 3:
                # Parse timestamp (00:00:10,500 --> 00:00:12,600)
                timestamp = parts[1].split(' --> ')[0]
                h, m, s = timestamp.replace(',', '.').split(':')
                start_seconds = int(h) * 3600 + int(m) * 60 + float(s)

                text = ' '.join(parts[2:])
                segments.append({
                    'start': start_seconds,
                    'duration': 2.0,  # Approximate
                    'text': text
                })

        return segments

    except HttpError as e:
        if e.resp.status == 403:
            raise Exception("YouTube API quota exceeded or permission denied")
        raise Exception(f"YouTube API error: {str(e)}")


# OAuth2 Endpoints
@app.get("/auth/youtube")
async def auth_youtube():
    """Initiate YouTube OAuth2 flow."""
    client_secret_path = BASE_DIR / YOUTUBE_OAUTH_CLIENT_SECRET

    if not client_secret_path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"OAuth client secret not found. Please place client_secret.json in backend/"
        )

    # Create OAuth flow
    flow = Flow.from_client_secrets_file(
        str(client_secret_path),
        scopes=SCOPES,
        redirect_uri='http://localhost:8000/auth/callback'
    )

    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )

    return {
        "authorization_url": authorization_url,
        "message": "Visit this URL to authorize YouTube access"
    }


@app.get("/auth/callback")
async def auth_callback(code: str, state: str = None):
    """Handle OAuth2 callback."""
    client_secret_path = BASE_DIR / YOUTUBE_OAUTH_CLIENT_SECRET

    flow = Flow.from_client_secrets_file(
        str(client_secret_path),
        scopes=SCOPES,
        redirect_uri='http://localhost:8000/auth/callback'
    )

    flow.fetch_token(code=code)
    creds = flow.credentials

    # Save credentials
    with open(TOKEN_FILE, 'wb') as token:
        pickle.dump(creds, token)

    return {
        "status": "success",
        "message": "YouTube authorization successful! Transcripts are now enabled."
    }


@app.get("/auth/youtube/status")
async def youtube_auth_status():
    """Check if YouTube OAuth is authorized."""
    creds = get_youtube_credentials()
    return {
        "authorized": creds is not None,
        "has_token": TOKEN_FILE.exists()
    }


@app.get("/youtube/transcript/{video_id}")
async def get_youtube_transcript(video_id: str):
    """Fetch YouTube video transcript using official API or fallback to scraper."""
    transcript_list = None
    method_used = "unknown"

    # Try official YouTube API first (requires OAuth)
    creds = get_youtube_credentials()
    if creds:
        try:
            print(f"🎯 Trying official YouTube Data API with OAuth for {video_id}")
            transcript_list = await fetch_youtube_captions_official(video_id)
            method_used = "official_api_oauth"
            print(f"✅ Official API (OAuth) succeeded! Got {len(transcript_list)} segments")
        except Exception as e:
            print(f"⚠️ Official API (OAuth) failed: {str(e)}")
            print(f"📌 Falling back to scraper...")
    else:
        print(f"⚠️ YouTube OAuth not authorized. Visit /auth/youtube to enable transcripts.")

    # Fallback to scraper if official API failed or not configured
    if not transcript_list:
        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            method_used = "scraper"
            print(f"✅ Scraper succeeded! Got {len(transcript_list)} segments")
        except Exception as scraper_error:
            print(f"⚠️ Scraper failed: {str(scraper_error)}")

            # Final fallback: Whisper transcription
            if OPENAI_API_KEY:
                try:
                    print(f"🎤 Falling back to Whisper transcription...")
                    transcript_list = await transcribe_youtube_with_whisper(video_id)
                    method_used = "whisper"
                    print(f"✅ Whisper transcription succeeded!")
                except Exception as whisper_error:
                    print(f"❌ Whisper also failed: {str(whisper_error)}")
                    raise HTTPException(
                        status_code=404,
                        detail=f"All transcript methods failed. Scraper: {str(scraper_error)}, Whisper: {str(whisper_error)}"
                    )
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Could not fetch transcript: {str(scraper_error)}. Set OPENAI_API_KEY to enable Whisper transcription."
                )

    # Format transcript as full text
    full_text = " ".join([entry['text'] for entry in transcript_list])

    # Ensure segments have required fields
    segments = [
        {
            "start": entry.get('start', 0),
            "duration": entry.get('duration', 2.0),
            "text": entry.get('text', '')
        }
        for entry in transcript_list
    ]

    return {
        "video_id": video_id,
        "transcript": full_text,
        "segments": segments,
        "length": len(segments),
        "method": method_used
    }


class VideoSolutionChatRequest(BaseModel):
    video_id: str
    question: str
    transcript: Optional[str] = None
    segments: Optional[List[Dict]] = None
    current_time: Optional[float] = None  # Current video position in seconds


@app.post("/video-solution/chat")
async def video_solution_chat(req: VideoSolutionChatRequest):
    """Answer questions about a solution video based on its transcript with timestamp awareness."""
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY is not set.")

    # If timestamp is provided and we have segments, filter to relevant portion
    if req.current_time is not None and req.segments:
        # Get segments around current timestamp (±30 seconds window)
        window_start = max(0, req.current_time - 30)
        window_end = req.current_time + 30

        relevant_segments = [
            seg for seg in req.segments
            if window_start <= seg['start'] <= window_end
        ]

        # Build context from relevant segments
        context_text = " ".join([seg['text'] for seg in relevant_segments])

        # Format timestamp for display
        minutes = int(req.current_time // 60)
        seconds = int(req.current_time % 60)
        timestamp_str = f"{minutes}:{seconds:02d}"

        prompt = f"""You are helping a user understand a LeetCode solution video.

The user paused the video at timestamp {timestamp_str} ({int(req.current_time)} seconds) and has a question.

RELEVANT TRANSCRIPT SECTION (around {timestamp_str}):
{context_text}

FULL TRANSCRIPT CONTEXT:
{req.transcript[:6000] if req.transcript else "Not available"}

The user's question is specifically about what's happening at {timestamp_str} in the video.

Answer based on:
1. The transcript section around their current timestamp
2. The broader context from the full transcript
3. Your knowledge of algorithms and data structures

Be specific and reference what's being explained at this point in the video.

User's question: {req.question}

Provide a clear, focused answer about what's happening at {timestamp_str}:"""
    else:
        # No timestamp provided - use full transcript
        prompt = f"""You are helping a user understand a LeetCode solution video.

VIDEO TRANSCRIPT:
{req.transcript[:8000] if req.transcript else "Not available"}

The user is watching this solution and has a question. Answer based on:
1. The transcript content
2. Your knowledge of algorithms and data structures
3. Help them understand specific parts they're confused about

Be conversational and reference timestamps when relevant.
Example: "Around 2:30 in the video, the instructor explains..."

User's question: {req.question}

Provide a clear, concise answer:"""

    model = genai.GenerativeModel(GEMINI_MODEL)
    response = await asyncio.to_thread(model.generate_content, prompt)

    return {
        "answer": response.text,
        "video_id": req.video_id,
        "timestamp": req.current_time
    }


# Initialize file watcher on startup
@app.on_event("startup")
async def startup_event():
    if WORKSPACE_DIR.exists():
        print(f"👀 Watching workspace: {WORKSPACE_DIR}")
        event_handler = CodeFileWatcher(WORKSPACE_DIR)
        observer = Observer()
        observer.schedule(event_handler, str(WORKSPACE_DIR), recursive=True)
        observer.start()
        
        # Store observer in app state for cleanup
        app.state.observer = observer
    else:
        print(f"⚠️  Workspace directory not found: {WORKSPACE_DIR}")


@app.on_event("shutdown")
async def shutdown_event():
    if hasattr(app.state, 'observer'):
        app.state.observer.stop()
        app.state.observer.join()
