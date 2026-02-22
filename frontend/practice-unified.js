// Unified Practice Interface - Voice Mentor + Video Solutions
// PROBLEMS object is loaded from problems.js script tag

// Dynamic URL detection: works on localhost dev AND Cloud Run
const API_BASE = (window.location.hostname === 'localhost' && window.location.port === '3000')
  ? 'http://localhost:8000'
  : window.location.origin;
const WS_HOST = (window.location.hostname === 'localhost' && window.location.port === '3000')
  ? 'localhost:8000'
  : window.location.host;

// ===== STATE MANAGEMENT =====
const state = {
  // Current problem
  currentProblem: null,
  currentProblemKey: null,
  currentLanguage: 'python',

  // Mode (voice or video)
  currentMode: 'voice', // 'voice' or 'video'

  // Voice Mentor State
  socket: null,
  isConnected: false,
  recognition: null,
  isListening: false,
  shouldRestart: false,

  // Video Solution State
  youtubePlayer: null,
  currentVideoTranscript: null,
  currentVideoSegments: null,
  videoRecognition: null,
  isVideoListening: false,
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  loadProblems();
  setupEventListeners();
  connectWebSocket();
  setupSpeechRecognition();
  setupVideoVoiceRecognition();
  loadYouTubeAPI();
});

// ===== PROBLEM LOADING =====
function loadProblems() {
  const container = document.getElementById('problems-list');

  Object.entries(PROBLEMS).forEach(([key, problem]) => {
    const card = document.createElement('div');
    card.className = 'problem-card';
    card.dataset.problem = key;

    const difficultyClass = `difficulty-${problem.difficulty.toLowerCase()}`;

    card.innerHTML = `
      <div class="problem-title">${problem.id}. ${problem.title}</div>
      <div class="problem-meta">
        <span class="difficulty-badge ${difficultyClass}">${problem.difficulty}</span>
        <span style="color: var(--text-muted)">${problem.tags.join(', ')}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      document.querySelectorAll('.problem-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      loadProblem(key);
    });

    container.appendChild(card);
  });

  // Load first problem by default
  const firstKey = Object.keys(PROBLEMS)[0];
  if (firstKey) {
    setTimeout(() => loadProblem(firstKey), 100);
    document.querySelector('.problem-card').classList.add('active');
  }
}

function loadProblem(problemKey) {
  const problem = PROBLEMS[problemKey];
  if (!problem) return;

  state.currentProblem = problem;
  state.currentProblemKey = problemKey;

  // Update header
  document.getElementById('current-problem-name').textContent = problem.title;
  document.getElementById('current-problem-desc').textContent =
    problem.description.split('\n')[0];

  // Load problem details
  document.getElementById('problem-description').textContent = problem.description;

  const constraintsList = document.getElementById('problem-constraints');
  constraintsList.innerHTML = problem.constraints
    .map(c => `<li>${c}</li>`)
    .join('');

  const examplesDiv = document.getElementById('problem-examples');
  examplesDiv.innerHTML = problem.examples
    .map((ex, i) => `
      <div class="example-box">
        <strong>Example ${i + 1}:</strong>
        <div style="margin-top: 6px;">Input: ${ex.input}</div>
        <div style="color: var(--success); margin-top: 4px;">Output: ${ex.output}</div>
        ${ex.explanation ? `<div style="margin-top: 6px; font-size: 12px;">${ex.explanation}</div>` : ''}
      </div>
    `)
    .join('');

  // Load starter code
  updateCodeEditor();

  // Update video button state
  const loadVideoBtn = document.getElementById('load-video-btn');
  if (problem.solutionVideo) {
    loadVideoBtn.disabled = false;
    loadVideoBtn.textContent = `Load Video (${problem.solutionVideo.duration})`;
  } else {
    loadVideoBtn.disabled = true;
    loadVideoBtn.textContent = 'No Video Available';
  }

  // Reset video if in video mode
  if (state.currentMode === 'video') {
    resetVideoPlayer();
  }

  // Add system message
  addVoiceMessage('system', `📚 Loaded: ${problem.title}`);
}

function updateCodeEditor() {
  if (!state.currentProblem) return;

  const editor = document.getElementById('code-editor');
  const starterCode = state.currentProblem.starterCode?.[state.currentLanguage];

  if (starterCode) {
    editor.value = starterCode;
  } else {
    editor.value = `# ${state.currentProblem.title}\n# Write your solution in ${state.currentLanguage}\n\n`;
  }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Mode toggle
  document.getElementById('voice-mode-btn').addEventListener('click', () => switchMode('voice'));
  document.getElementById('video-mode-btn').addEventListener('click', () => switchMode('video'));

  // Language selector
  document.getElementById('language-select').addEventListener('change', (e) => {
    state.currentLanguage = e.target.value;
    updateCodeEditor();
  });

  // Reset button
  document.getElementById('reset-btn').addEventListener('click', resetAll);

  // Voice chat
  document.getElementById('send-btn').addEventListener('click', sendVoiceMessage);
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendVoiceMessage();
    }
  });
  document.getElementById('voice-toggle-btn').addEventListener('click', toggleVoiceSession);

  // Video chat
  document.getElementById('video-send-btn').addEventListener('click', sendVideoMessage);
  document.getElementById('video-chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendVideoMessage();
    }
  });
  document.getElementById('video-voice-btn').addEventListener('click', toggleVideoVoice);

  // Load video button
  document.getElementById('load-video-btn').addEventListener('click', loadVideoSolution);

  // Run tests
  document.getElementById('run-tests-btn').addEventListener('click', runTests);

  // Auto-resize textareas
  ['chat-input', 'video-chat-input'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  });
}

// ===== MODE SWITCHING =====
function switchMode(mode) {
  state.currentMode = mode;

  // Update toggle buttons
  document.getElementById('voice-mode-btn').classList.toggle('active', mode === 'voice');
  document.getElementById('video-mode-btn').classList.toggle('active', mode === 'video');

  // Toggle panels
  document.getElementById('voice-mentor-panel').classList.toggle('hidden', mode !== 'voice');
  document.getElementById('video-solution-panel').classList.toggle('hidden', mode !== 'video');

  // Stop voice if switching away
  if (mode !== 'voice' && state.isListening) {
    stopVoiceSession();
  }
}

// ===== VOICE MENTOR MODE =====
function connectWebSocket() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  // Connect to backend server on port 8000
  const wsUrl = `${proto}://${WS_HOST}/ws`;

  state.socket = new WebSocket(wsUrl);

  state.socket.addEventListener('open', () => {
    state.isConnected = true;
    updateStatus('connected', 'Connected');
  });

  state.socket.addEventListener('close', () => {
    state.isConnected = false;
    updateStatus('disconnected', 'Disconnected');
    setTimeout(connectWebSocket, 3000);
  });

  state.socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  });
}

function updateStatus(status, text) {
  const dot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  dot.className = 'status-dot' + (status === 'disconnected' ? ' disconnected' : '');
  statusText.textContent = text;
}

function handleWebSocketMessage(data) {
  const container = document.getElementById('voice-chat-messages');
  const empty = container.querySelector('.chat-empty');
  if (empty) empty.remove();

  if (data.type === 'llm_message') {
    addVoiceMessage('assistant', data.text);

    // Auto-play TTS if in voice session (uses ElevenLabs)
    if (state.isListening) {
      playTTS(data.text);
    }
  } else if (data.type === 'context_update') {
    addVoiceMessage('system', `📝 Updated: ${data.filename}`);
  } else if (data.type === 'error') {
    addVoiceMessage('system', `❌ Error: ${data.message}`);
  }
}

function sendVoiceMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();

  if (!text || !state.isConnected) return;

  const code = document.getElementById('code-editor').value;

  addVoiceMessage('user', text);

  state.socket.send(JSON.stringify({
    type: 'user_message',
    text: text,
    code_context: code || null
  }));

  input.value = '';
  input.style.height = 'auto';
}

function addVoiceMessage(role, content) {
  const container = document.getElementById('voice-chat-messages');
  const empty = container.querySelector('.chat-empty');
  if (empty) empty.remove();

  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;

  if (role !== 'system') {
    messageEl.innerHTML = `
      <div class="message-header">
        <span class="message-role ${role}">${role === 'user' ? 'You' : 'Vela'}</span>
      </div>
      <div class="message-content">${content}</div>
    `;
  } else {
    messageEl.innerHTML = `<div class="message-content">${content}</div>`;
  }

  container.appendChild(messageEl);
  container.scrollTop = container.scrollHeight;
}

// ===== SPEECH RECOGNITION =====
function setupSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    console.warn('Speech recognition not supported');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.recognition = new SpeechRecognition();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = 'en-US';

  state.recognition.onstart = () => {
    state.isListening = true;
    state.shouldRestart = true;
    document.getElementById('voice-toggle-btn').classList.add('listening');
    addVoiceMessage('system', '🎤 Listening... speak naturally!');
  };

  state.recognition.onresult = (event) => {
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      }
    }

    if (finalTranscript.trim()) {
      const input = document.getElementById('chat-input');
      input.value = finalTranscript.trim();
      sendVoiceMessage();
    }
  };

  state.recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      stopVoiceSession();
      addVoiceMessage('system', '❌ Microphone access denied');
    }
  };

  state.recognition.onend = () => {
    if (state.shouldRestart && state.isListening) {
      try {
        state.recognition.start();
      } catch (err) {
        console.error('Failed to restart:', err);
        stopVoiceSession();
      }
    } else {
      stopVoiceSession();
    }
  };
}

function toggleVoiceSession() {
  if (!state.recognition) {
    addVoiceMessage('system', '❌ Speech recognition not supported');
    return;
  }

  if (state.isListening) {
    stopVoiceSession();
  } else {
    startVoiceSession();
  }
}

function startVoiceSession() {
  try {
    state.shouldRestart = true;
    state.recognition.start();

    // Vela's greeting with ElevenLabs voice
    setTimeout(() => {
      const greeting = "Hi! I'm Vela, your AI pair programming mentor. How can I help you today?";
      addVoiceMessage('assistant', greeting);
      playTTS(greeting);
    }, 1000);
  } catch (err) {
    console.error('Failed to start voice:', err);
    addVoiceMessage('system', '❌ Failed to start voice session');
  }
}

function stopVoiceSession() {
  state.shouldRestart = false;
  state.isListening = false;

  try {
    if (state.recognition) {
      state.recognition.stop();
    }
  } catch (err) {
    console.error('Stop error:', err);
  }

  document.getElementById('voice-toggle-btn').classList.remove('listening');
  addVoiceMessage('system', '🎤 Stopped listening');
}

// ===== TEXT-TO-SPEECH =====
async function playTTS(text, useBrowserFallback = false) {
  try {
    // Use ElevenLabs by default for high-quality voice
    if (!useBrowserFallback) {
      const response = await fetch('${API_BASE}/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_id: null })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        console.log(`✅ ElevenLabs TTS: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => URL.revokeObjectURL(audioUrl);
        await audio.play();
        console.log('✅ ElevenLabs TTS playing successfully');
        return; // Success - don't fall back
      } else {
        console.warn('⚠️ ElevenLabs API failed, falling back to browser TTS');
      }
    }

    // Fallback to browser TTS if requested or if ElevenLabs failed
    console.log('⚠️ Falling back to browser TTS');
    useBrowserTTS(text);
  } catch (err) {
    console.error('TTS error:', err);
    useBrowserTTS(text);
  }
}

function useBrowserTTS(text) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  const cleanText = text
    .replace(/`/g, '')
    .replace(/'(\w+)'/g, '$1')
    .replace(/"(\w+)"/g, '$1')
    .replace(/O\(N\^2\)/g, 'O of N squared')
    .replace(/O\(N\)/g, 'O of N')
    .replace(/O\(1\)/g, 'O of 1')
    .replace(/\s+/g, ' ')
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.15;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  utterance.lang = 'en-US';

  window.speechSynthesis.speak(utterance);
}

// ===== VIDEO VOICE INPUT =====
function setupVideoVoiceRecognition() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    console.warn('Speech recognition not supported');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.videoRecognition = new SpeechRecognition();
  state.videoRecognition.continuous = false; // Single utterance for video questions
  state.videoRecognition.interimResults = false;
  state.videoRecognition.lang = 'en-US';

  state.videoRecognition.onstart = () => {
    state.isVideoListening = true;
    document.getElementById('video-voice-btn').classList.add('listening');
  };

  state.videoRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript.trim()) {
      const input = document.getElementById('video-chat-input');
      input.value = transcript.trim();
      sendVideoMessage();
    }
  };

  state.videoRecognition.onerror = (event) => {
    console.error('Video speech recognition error:', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      addVideoMessage('system', '❌ Microphone access denied');
    }
    state.isVideoListening = false;
    document.getElementById('video-voice-btn').classList.remove('listening');
  };

  state.videoRecognition.onend = () => {
    state.isVideoListening = false;
    document.getElementById('video-voice-btn').classList.remove('listening');
  };
}

function toggleVideoVoice() {
  if (!state.videoRecognition) {
    setupVideoVoiceRecognition();
    if (!state.videoRecognition) {
      addVideoMessage('system', '❌ Speech recognition not supported');
      return;
    }
  }

  if (state.isVideoListening) {
    state.videoRecognition.stop();
  } else {
    try {
      state.videoRecognition.start();
    } catch (err) {
      console.error('Failed to start video voice:', err);
      addVideoMessage('system', '❌ Failed to start voice input');
    }
  }
}

// ===== VIDEO SOLUTION MODE =====
function loadYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = () => {
  console.log('✅ YouTube API ready');
};

async function loadVideoSolution() {
  if (!state.currentProblem?.solutionVideo) return;

  const video = state.currentProblem.solutionVideo;
  const placeholder = document.getElementById('video-placeholder');
  const playerContainer = document.getElementById('video-player-container');

  // Show player
  placeholder.style.display = 'none';
  playerContainer.style.display = 'block';

  // Destroy existing player
  if (state.youtubePlayer) {
    state.youtubePlayer.destroy();
  }

  // Create YouTube player
  state.youtubePlayer = new YT.Player('video-player-container', {
    videoId: video.videoId,
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0
    },
    events: {
      onReady: () => console.log('✅ Video ready'),
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.PAUSED) {
          const time = state.youtubePlayer.getCurrentTime();
          console.log(`⏸️ Paused at ${formatTimestamp(time)}`);
        }
      }
    }
  });

  // Fetch transcript
  try {
    const response = await fetch(`${API_BASE}/youtube/transcript/${video.videoId}`);
    if (response.ok) {
      const data = await response.json();
      state.currentVideoTranscript = data.transcript;
      state.currentVideoSegments = data.segments;

      addVideoMessage(
        'assistant',
        `✅ Transcript loaded! I can answer timestamp-aware questions about this video. Pause at any point and ask!`
      );
    } else {
      state.currentVideoTranscript = null;
      state.currentVideoSegments = null;

      addVideoMessage(
        'assistant',
        `This video doesn't have captions, but I can still help explain the concepts!`
      );
    }
  } catch (error) {
    console.error('Transcript fetch error:', error);
    state.currentVideoTranscript = null;
    state.currentVideoSegments = null;
  }
}

function resetVideoPlayer() {
  const placeholder = document.getElementById('video-placeholder');
  const playerContainer = document.getElementById('video-player-container');

  if (state.youtubePlayer) {
    state.youtubePlayer.destroy();
    state.youtubePlayer = null;
  }

  playerContainer.style.display = 'none';
  placeholder.style.display = 'flex';

  state.currentVideoTranscript = null;
  state.currentVideoSegments = null;
}

function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function sendVideoMessage() {
  const input = document.getElementById('video-chat-input');
  const text = input.value.trim();

  if (!text) return;

  // Get video timestamp
  let currentTime = null;
  if (state.youtubePlayer && state.youtubePlayer.getCurrentTime) {
    try {
      currentTime = state.youtubePlayer.getCurrentTime();
    } catch (e) {
      console.warn('Could not get video time:', e);
    }
  }

  const userMessageText = currentTime !== null
    ? `[${formatTimestamp(currentTime)}] ${text}`
    : text;

  addVideoMessage('user', userMessageText);

  const thinkingId = addVideoMessage('assistant', 'Thinking...');

  input.value = '';
  input.style.height = 'auto';

  try {
    let answer;

    if (state.currentVideoTranscript) {
      const response = await fetch(`${API_BASE}/video-solution/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: state.currentProblem.solutionVideo.videoId,
          question: text,
          transcript: state.currentVideoTranscript,
          segments: state.currentVideoSegments,
          current_time: currentTime
        })
      });

      if (response.ok) {
        const data = await response.json();
        answer = data.answer;
      } else {
        throw new Error('API request failed');
      }
    } else {
      answer = 'The transcript is not available. However, I can help explain general concepts about this problem. What would you like to know?';
    }

    replaceVideoMessage(thinkingId, answer);
  } catch (error) {
    console.error('Video chat error:', error);
    replaceVideoMessage(thinkingId, 'Sorry, I encountered an error. Please try again.');
  }
}

function addVideoMessage(role, content) {
  const container = document.getElementById('video-chat-messages');
  const messageId = `video-msg-${Date.now()}`;

  const messageEl = document.createElement('div');
  messageEl.id = messageId;
  messageEl.className = `message ${role}`;

  if (role !== 'system') {
    messageEl.innerHTML = `
      <div class="message-header">
        <span class="message-role ${role}">${role === 'user' ? 'You' : 'AI Video Guide'}</span>
      </div>
      <div class="message-content">${content}</div>
    `;
  } else {
    messageEl.innerHTML = `<div class="message-content">${content}</div>`;
  }

  container.appendChild(messageEl);
  container.scrollTop = container.scrollHeight;

  return messageId;
}

function replaceVideoMessage(messageId, newContent) {
  const messageEl = document.getElementById(messageId);
  if (messageEl) {
    messageEl.innerHTML = `
      <div class="message-header">
        <span class="message-role assistant">AI Video Guide</span>
      </div>
      <div class="message-content">${newContent}</div>
    `;
  }
}

// ===== RUN TESTS =====
async function runTests() {
  const code = document.getElementById('code-editor').value;
  const testStatus = document.getElementById('test-status');

  if (!state.currentProblem) {
    testStatus.textContent = '❌ No problem selected';
    return;
  }

  testStatus.textContent = '⏳ Running tests...';
  testStatus.style.color = 'var(--text-muted)';

  try {
    const response = await fetch(`${API_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code,
        language: state.currentLanguage,
        test_cases: state.currentProblem.testCases || []
      })
    });

    if (!response.ok) throw new Error('Execution failed');

    const result = await response.json();

    if (result.all_passed) {
      testStatus.textContent = `✅ ${result.passed_tests}/${result.total_tests} tests passed!`;
      testStatus.style.color = 'var(--success)';
      addVoiceMessage('system', '🎉 All tests passed!');
    } else {
      testStatus.textContent = `❌ ${result.passed_tests}/${result.total_tests} tests passed`;
      testStatus.style.color = 'var(--error)';

      const failedTests = result.results.filter(r => !r.passed);
      failedTests.forEach(test => {
        const errorMsg = test.error ? `\nError: ${test.error}` : '';
        addVoiceMessage('system', `❌ Test ${test.test_num} failed:\nExpected: ${test.expected}\nGot: ${test.output}${errorMsg}`);
      });
    }
  } catch (error) {
    testStatus.textContent = '❌ Execution error';
    testStatus.style.color = 'var(--error)';
    addVoiceMessage('system', `❌ Error: ${error.message}`);
  }
}

// ===== RESET =====
function resetAll() {
  if (!confirm('Reset conversation and code?')) return;

  // Reset voice chat
  document.getElementById('voice-chat-messages').innerHTML = `
    <div class="chat-empty">
      <div class="chat-empty-icon">💬</div>
      <div class="chat-empty-title">Start a voice session or type a message</div>
      <div class="chat-empty-subtitle">
        Vela has full context of your code and problem. Ask anything!
      </div>
    </div>
  `;

  // Reset video chat
  document.getElementById('video-chat-messages').innerHTML = `
    <div class="message assistant">
      <div class="message-header">
        <span class="message-role assistant">AI Video Guide</span>
      </div>
      <div class="message-content">
        Watch the solution video above, then ask me any questions!
      </div>
    </div>
  `;

  // Reset code
  updateCodeEditor();

  // Stop voice if active
  if (state.isListening) {
    stopVoiceSession();
  }

  // Reset video
  if (state.currentMode === 'video') {
    resetVideoPlayer();
  }
}
