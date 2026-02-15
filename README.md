<div align="center">

# ⚡ VelocityAI

### Master Data Structures & Algorithms Through Voice, Video, and Visualization

**An AI-powered learning platform that combines voice mentoring, interactive visualizations, and video-enhanced learning to make DSA intuitive and engaging.**

[🎯 What We Built](#what-we-built) • [🎬 Demo](#demo) • [🚀 Getting Started](#getting-started) • [🛠️ Technologies](#technologies)

</div>

---

## 🎯 What We Built

VelocityAI is a comprehensive AI-powered learning platform with three core features designed to transform how you learn data structures and algorithms:

### 1. **Vela - Voice AI Mentor** 🎙️
An intelligent pair programming companion that teaches through Socratic dialogue:
- **Real-time code awareness** - Watches your workspace and understands your code context
- **Voice-first interaction** - Natural conversation using speech recognition and professional TTS
- **Socratic teaching** - Guides you to discover solutions through strategic questions instead of giving answers
- **Instant feedback** - Powered by Google Gemini 2.5 for sub-second responses

### 2. **Video Solution Conversator** 📺
AI-enhanced video learning with context-aware explanations:
- **YouTube integration** - Watch NeetCode and other tutorial videos directly in the platform
- **Automatic transcription** - Uses OpenAI Whisper to transcribe any YouTube video
- **Timestamp-aware AI** - Vela knows exactly where you are in the video and can explain that specific moment
- **Interactive Q&A** - Pause anytime to ask questions about what's being explained

### 3. **Algorithm Visualizer** 🎨
Educational animations with synchronized voice narration:
- **AI-generated animations** - Gemini creates step-by-step GSAP visualizations for any algorithm
- **Educational content** - Each visualization includes definitions, key points, use cases, and common problems
- **Voice narration** - ElevenLabs professional voice synthesis explains each step
- **Interactive controls** - Play, pause, adjust speed, and step through animations frame-by-frame

---

## 💡 Why We Built This

Learning data structures and algorithms is **hard** because:
- ❌ Reading code doesn't show you *how* it works
- ❌ Static diagrams don't capture the dynamic flow
- ❌ Video tutorials don't adapt to your questions
- ❌ You can't just "talk through" your confusion

**VelocityAI solves all of this** by combining:
- ✅ **Voice interaction** - Think out loud and get immediate guidance
- ✅ **Dynamic visualization** - See algorithms come alive step-by-step
- ✅ **Video understanding** - AI that comprehends tutorial content
- ✅ **Personalized teaching** - Adapts to your understanding level

---

## 🎬 Demo

### Voice Mentor in Action
```
You: "How do I approach the two sum problem?"

Vela: "Great question! Before we dive into code, what is the problem
      really asking us to find?"

You: "We need to find two numbers that add up to a target"

Vela: "Exactly! And what data structure allows you to check if an
      element exists in constant time?"

You: "A hash map?"

Vela: "Perfect! Now think about this - as you iterate through the array,
      what could you store in that hash map to help you find the pair?"
```

### Video Solution Conversator
- Load any YouTube coding tutorial
- AI auto-transcribes with Whisper
- Ask "Why did he use a hash map here?"
- Vela explains based on the exact timestamp

### Algorithm Visualizer
- Click "Binary Search Tree" → Watch nodes animate in real-time
- See insertions, rotations, and traversals step-by-step
- Hear voice explanations synchronized with animations
- Learn through visual storytelling

---

## 🛠️ Technologies

### Frontend
- **Vanilla JavaScript** - Fast, lightweight, no framework overhead
- **GSAP (GreenSock)** - Professional animation engine for visualizations
- **Web Speech API** - Browser-native speech recognition
- **YouTube IFrame API** - Embedded video player integration

### Backend
- **Python 3.9+** - Main application language
- **FastAPI** - High-performance async web framework
- **WebSockets** - Real-time bidirectional communication
- **Uvicorn** - Lightning-fast ASGI server

### AI & ML Services
- **Google Gemini 2.5 Flash** - Advanced reasoning and code understanding (1M+ token context)
- **ElevenLabs API** - Professional voice synthesis (neural TTS)
- **OpenAI Whisper** - Automatic speech-to-text transcription for YouTube videos

### Additional Tools
- **youtube-transcript-api** - Fetch existing YouTube captions
- **yt-dlp** - Download YouTube audio for transcription
- **Watchdog** - Real-time file system monitoring for code awareness
- **python-dotenv** - Environment variable management

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Google Gemini API key (free at [ai.google.dev](https://ai.google.dev/))
- (Optional) ElevenLabs API key for premium voice
- (Optional) OpenAI API key for video transcription

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/VelocityAI.git
cd VelocityAI
```

**2. Install backend dependencies**
```bash
cd backend
pip install -r requirements.txt
```

**3. Configure environment variables**
```bash
# Copy example config
cp .env.example .env

# Edit .env and add your API keys
GEMINI_API_KEY=your_gemini_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here  # Optional
OPENAI_API_KEY=your_openai_key_here           # Optional, for video transcription
WORKSPACE_DIR=/path/to/your/code/directory
```

**4. Start the servers**

Terminal 1 - Backend:
```bash
cd backend
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2 - Frontend:
```bash
cd frontend
python3 -m http.server 3000
```

**5. Open in browser**
```
http://localhost:3000/landing.html
```

---

## 📁 Project Structure

```
VelocityAI/
├── frontend/
│   ├── landing.html          # Landing page
│   ├── practice-unified.html # Main practice interface
│   ├── practice-unified.js   # Voice mentor + video solution logic
│   ├── visualize.html        # Algorithm visualizer
│   ├── visualize.js          # Animation engine
│   └── problems.js           # Problem database (8+ DSA problems)
│
├── backend/
│   ├── app.py                # FastAPI server with WebSocket
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Environment config template
│   └── transcripts_cache/    # Cached YouTube transcriptions
│
└── README.md
```

---

## 🎯 Key Features Breakdown

### Real-Time Code Awareness
```python
# Backend watches your workspace
from watchdog.observers import Observer

# Automatically detects changes in .py, .js, .ts, .cpp, .java, etc.
# Sends updated context to Gemini for intelligent responses
```

### Voice Synthesis
```python
# Professional TTS with ElevenLabs
async def synthesize_tts(text: str, voice_id: str):
    # Speed optimized for learning (1.1x)
    # Clear, natural-sounding AI voice
    # Fallback to browser TTS if API unavailable
```

### AI-Generated Animations
```python
# Gemini generates complete visualization JSON
{
  "educational": {
    "definition": "Binary Search Tree is...",
    "keyPoints": ["...", "...", "..."],
    "whenToUse": "Use when...",
    "commonProblems": ["...", "..."]
  },
  "steps": [
    {
      "commands": [
        {"command": "CREATE_NODE", "id": "node1", "value": 15}
      ],
      "narration": "First, we insert 15 as the root node",
      "duration": 2000
    }
  ]
}
```

### Video Transcription Pipeline
```python
# Fallback chain for robust transcription
1. Try YouTube's existing captions (fast)
2. Use yt-dlp to download audio
3. Transcribe with OpenAI Whisper
4. Cache result for instant future access
```

---

## 🌟 What Makes VelocityAI Special

### 1. **Multimodal Learning**
Not just text, not just video, not just animations - **all three combined** with AI guidance.

### 2. **Context-Aware AI**
Vela understands:
- What code you're writing (file watching)
- What video you're watching (transcript analysis)
- What concept you're visualizing (animation state)

### 3. **Voice-First Design**
Built for conversation, not typing. Natural speech recognition with professional TTS creates a fluid learning experience.

### 4. **Educational Content**
Every visualization includes:
- Formal definitions
- Key concepts
- Real-world use cases
- Common problem patterns

### 5. **Production-Ready**
- WebSocket for real-time communication
- Caching for performance (transcript cache, file watching)
- Error handling and fallbacks
- CORS configured for cross-origin requests

---

## 🎓 Use Cases

### For Students
- **Interview prep** - Practice explaining your thinking out loud
- **Concept mastery** - See and hear algorithms in action
- **Video learning** - Get clarification on tutorial videos instantly

### For Educators
- **Teach visually** - Use visualizer to demonstrate concepts
- **Assess understanding** - Students practice Socratic dialogue
- **Supplement videos** - Add interactive Q&A to video content

### For Self-Learners
- **Build intuition** - Voice mentor helps you discover patterns
- **Debug thinking** - Talk through your approach to find gaps
- **Learn your way** - Combine video, voice, and visuals as needed

---

## 🏗️ Technical Highlights

### Performance
- **Sub-second AI responses** using Gemini 2.5 Flash
- **Cached transcriptions** avoid re-processing videos
- **Real-time file watching** with debouncing to prevent spam
- **WebSocket streaming** for instant message delivery

### Scalability
- **Async Python** with FastAPI for concurrent users
- **Stateless backend** ready for horizontal scaling
- **CDN-friendly frontend** (static HTML/JS/CSS)
- **API-first architecture** easy to extend

### Reliability
- **Graceful fallbacks** (ElevenLabs → Browser TTS)
- **Error recovery** (Transcript API → Scraper → Whisper)
- **Health checks** for monitoring
- **Auto-reload** in development mode

---

## 📝 License

MIT License - Free to use, modify, and build upon.

---

<div align="center">

### 🚀 Built for Hackathon PatHack 2026

**Technologies:** Python • FastAPI • JavaScript • GSAP • Google Gemini • ElevenLabs • OpenAI Whisper

**Team:** VelocityAI

⭐ **Star this repo** if you believe in better ways to learn!

[Get Started](#getting-started) • [View Demo](#demo)

</div>
