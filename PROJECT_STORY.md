# VelocityAI - Project Story

## Inspiration
Learning data structures and algorithms from videos and static tutorials is frustrating. You can't ask questions when confused, can't see how algorithms actually work step-by-step, and typing out questions breaks your flow. We wanted to combine voice, video, and visualization into one learning platform.

## What it does
VelocityAI has three features:

1. **Vela (Voice Mentor)** - Talk to an AI that sees your code in real-time and teaches through questions instead of giving answers. Uses speech recognition and professional voice synthesis.

2. **Video Solution Helper** - Watch YouTube coding tutorials while chatting with AI about what's happening. AI transcribes videos and answers questions based on the exact timestamp.

3. **Algorithm Visualizer** - Type what you want to learn (like "binary search tree insertion") and watch AI-generated animations with voice explanations. Shows definitions, use cases, and step-by-step visuals.

## How we built it
- **Frontend:** Vanilla JavaScript, GSAP for animations, Web Speech API, YouTube IFrame API
- **Backend:** Python FastAPI with WebSockets for real-time communication
- **AI Services:**
  - Google Gemini 2.5 for teaching and generating visualizations
  - ElevenLabs for natural voice synthesis
  - OpenAI Whisper for transcribing YouTube videos
- **Tools:** File watcher for code awareness, yt-dlp for downloading audio, caching for performance

## Challenges we ran into
1. **YouTube transcription** - YouTube's API only works for your own videos. Had to build a fallback: try captions → try scraper → download audio with yt-dlp → transcribe with Whisper. Added caching so we don't re-transcribe.

2. **CORS issues** - Frontend and backend on different ports caused blocked requests. Fixed with CORS middleware and proper URL configuration.

3. **Getting Gemini to generate correct animation format** - First attempts generated broken JSON or missing command fields. Had to write detailed prompts with exact examples showing the required format.

4. **File:// vs HTTP** - Opening HTML files directly doesn't work with APIs. Set up Python HTTP server for frontend.

5. **Voice synthesis quality** - ElevenLabs API calls were failing due to CORS preflight. Added fallback to browser TTS and fixed CORS config.

## Accomplishments that we're proud of
- **Actually works end-to-end** - All three features functional with real AI integration
- **Voice-first learning** - Natural conversation with code awareness feels like pair programming
- **Automatic video transcription** - Any YouTube video gets transcribed and cached
- **AI-generated animations** - Gemini creates complete visualizations with educational content
- **Production-ready architecture** - WebSockets, caching, error handling, fallbacks all implemented

## What we learned
- **Prompt engineering matters** - Small changes in how we described animation format to Gemini made huge difference
- **Multiple AI APIs working together** - Gemini for reasoning, ElevenLabs for voice, Whisper for transcription
- **Real-time systems** - WebSockets, file watching, streaming responses
- **Graceful degradation** - Always have fallbacks (ElevenLabs → browser TTS, transcript API → Whisper)
- **CORS and web security** - Understanding preflight requests and proper server configuration

## What's next for VelocityAI
- Add more DSA problems and topics
- Support other video platforms beyond YouTube
- Save learning progress and track what you've mastered
- Practice mode with hints that adjust to your level
- Mobile support for learning on the go
