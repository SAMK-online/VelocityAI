// Practice V2 with Video Solutions
import PROBLEMS from './problems.js';

// State
let currentProblem = null;
let currentVideoTranscript = null;
let currentVideoSegments = null;
let currentLanguage = 'python';
let youtubePlayer = null;  // YouTube iframe API player instance

// Load YouTube iframe API
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// YouTube API callback
window.onYouTubeIframeAPIReady = () => {
  console.log('✅ YouTube iframe API ready');
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  setupProblemSelector();
  setupEventListeners();
});

function setupProblemSelector() {
  const select = document.getElementById('problem-select');

  // Populate problem dropdown
  Object.entries(PROBLEMS).forEach(([key, problem]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${problem.id}. ${problem.title}`;
    select.appendChild(option);
  });

  // Handle problem selection
  select.addEventListener('change', (e) => {
    const problemKey = e.target.value;
    if (problemKey) {
      loadProblem(problemKey);
    }
  });
}

function setupEventListeners() {
  // Watch Solution button
  document.getElementById('watch-solution-btn').addEventListener('click', () => {
    if (currentProblem && currentProblem.solutionVideo) {
      loadVideoSolution();
    }
  });

  // Language selector
  document.getElementById('language-select').addEventListener('change', (e) => {
    currentLanguage = e.target.value;
    updateCodeEditor();
  });

  // Chat input
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const input = e.target.value.trim();
      if (input) {
        sendChatMessage(input);
        e.target.value = '';
      }
    }
  });

  // Voice input
  setupVoiceInput();
}

function loadProblem(problemKey) {
  currentProblem = PROBLEMS[problemKey];
  if (!currentProblem) return;

  // Update problem display
  document.getElementById('problem-title').textContent = currentProblem.title;

  // Update difficulty
  const difficultyEl = document.getElementById('problem-difficulty');
  difficultyEl.textContent = currentProblem.difficulty;
  difficultyEl.className = `difficulty ${currentProblem.difficulty.toLowerCase()}`;

  // Update tags
  const tagsContainer = document.getElementById('problem-tags');
  tagsContainer.innerHTML = currentProblem.tags
    .map(tag => `<span class="tag">${tag}</span>`)
    .join('');

  // Update description
  const descEl = document.getElementById('problem-description');
  descEl.innerHTML = `
    <h4>Problem Description</h4>
    <p>${currentProblem.description}</p>

    ${currentProblem.constraints ? `
      <h4>Constraints</h4>
      <ul>
        ${currentProblem.constraints.map(c => `<li>${c}</li>`).join('')}
      </ul>
    ` : ''}

    ${currentProblem.examples ? `
      <h4>Examples</h4>
      ${currentProblem.examples.map(ex => `
        <div style="margin-bottom: 12px;">
          <strong>Input:</strong> <pre>${ex.input}</pre>
          <strong>Output:</strong> <pre>${ex.output}</pre>
          ${ex.explanation ? `<strong>Explanation:</strong> ${ex.explanation}` : ''}
        </div>
      `).join('')}
    ` : ''}
  `;

  // Load starter code
  updateCodeEditor();

  // Enable Watch Solution button if video exists
  const watchBtn = document.getElementById('watch-solution-btn');
  if (currentProblem.solutionVideo) {
    watchBtn.disabled = false;
    watchBtn.textContent = `▶ Watch Solution (${currentProblem.solutionVideo.duration})`;
  } else {
    watchBtn.disabled = true;
    watchBtn.textContent = '▶ Watch Solution';
  }

  // Collapse video pane when switching problems
  document.getElementById('right-pane').classList.add('collapsed');

  // Destroy YouTube player if it exists
  if (youtubePlayer) {
    youtubePlayer.destroy();
    youtubePlayer = null;
  }

  // Reset video UI
  const videoPlayerContainer = document.getElementById('video-player');
  videoPlayerContainer.style.display = 'none';
  videoPlayerContainer.innerHTML = '';  // Clear any existing content
  document.getElementById('video-placeholder').style.display = 'flex';

  // Clear transcript data
  currentVideoTranscript = null;
  currentVideoSegments = null;
}

function updateCodeEditor() {
  if (!currentProblem) return;

  const editor = document.getElementById('code-editor');
  const starterCode = currentProblem.starterCode?.[currentLanguage];

  if (starterCode) {
    editor.value = starterCode;
  } else {
    editor.value = `# ${currentProblem.title}\n# Write your solution in ${currentLanguage}\n\n`;
  }
}

async function loadVideoSolution() {
  if (!currentProblem?.solutionVideo) return;

  const video = currentProblem.solutionVideo;
  const rightPane = document.getElementById('right-pane');
  const videoPlayerContainer = document.getElementById('video-player');
  const videoPlaceholder = document.getElementById('video-placeholder');

  // Show right pane
  rightPane.classList.remove('collapsed');

  // Update video info
  document.getElementById('video-title').textContent = video.title;
  document.getElementById('video-channel').textContent = video.channel;

  // Hide placeholder, show player container
  videoPlaceholder.style.display = 'none';
  videoPlayerContainer.style.display = 'block';

  // Destroy existing player if any
  if (youtubePlayer) {
    youtubePlayer.destroy();
  }

  // Create new YouTube player using iframe API
  youtubePlayer = new YT.Player('video-player', {
    videoId: video.videoId,
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0
    },
    events: {
      onReady: (event) => {
        console.log('✅ YouTube player ready');
      },
      onStateChange: (event) => {
        // Track when user pauses/plays
        if (event.data === YT.PlayerState.PAUSED) {
          const currentTime = youtubePlayer.getCurrentTime();
          console.log(`⏸️ Video paused at ${formatTimestamp(currentTime)}`);
        }
      }
    }
  });

  // Fetch transcript in background
  try {
    const response = await fetch(`/youtube/transcript/${video.videoId}`);
    if (response.ok) {
      const data = await response.json();
      currentVideoTranscript = data.transcript;
      currentVideoSegments = data.segments;
      console.log('✅ Transcript loaded:', data.segments.length, 'segments');

      addChatMessage(
        `Transcript loaded! I can now answer timestamp-aware questions about this ${video.duration} video. Pause at any point and ask me what's happening!`,
        'ai'
      );
    } else {
      currentVideoTranscript = null;
      currentVideoSegments = null;
      console.warn('No transcript available for this video');

      addChatMessage(
        `This video doesn't have captions available, but I can still help explain the concepts! What would you like to know?`,
        'ai'
      );
    }
  } catch (error) {
    console.error('Failed to fetch transcript:', error);
    currentVideoTranscript = null;
    currentVideoSegments = null;

    addChatMessage(
      `Couldn't load the transcript, but I can still help! What questions do you have?`,
      'ai'
    );
  }
}

function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function sendChatMessage(message) {
  if (!message.trim()) return;

  // Get current video timestamp if player is ready
  let currentTime = null;
  if (youtubePlayer && youtubePlayer.getCurrentTime) {
    try {
      currentTime = youtubePlayer.getCurrentTime();
      console.log(`📍 Sending question at timestamp: ${formatTimestamp(currentTime)}`);
    } catch (e) {
      console.warn('Could not get current video time:', e);
    }
  }

  // Add user message with timestamp indicator
  const userMessageText = currentTime !== null
    ? `[${formatTimestamp(currentTime)}] ${message}`
    : message;
  addChatMessage(userMessageText, 'user');

  // Show thinking indicator
  const thinkingId = addChatMessage('Thinking...', 'ai');

  try {
    let answer;

    if (currentVideoTranscript) {
      // Use video-solution endpoint with transcript and timestamp
      const response = await fetch(`/video-solution/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: currentProblem.solutionVideo.videoId,
          question: message,
          transcript: currentVideoTranscript,
          segments: currentVideoSegments,
          current_time: currentTime  // Include timestamp for context
        })
      });

      if (response.ok) {
        const data = await response.json();
        answer = data.answer;
      } else {
        throw new Error('API request failed');
      }
    } else {
      // Fallback: Use general knowledge
      answer = await getGeneralAnswer(message);
    }

    // Replace thinking message with actual answer
    replaceChatMessage(thinkingId, answer, 'ai');

  } catch (error) {
    console.error('Chat error:', error);
    replaceChatMessage(
      thinkingId,
      `Sorry, I encountered an error. Please try again.`,
      'ai'
    );
  }
}

async function getGeneralAnswer(question) {
  // Fallback: answer based on problem context without transcript
  const context = currentProblem ? `
Problem: ${currentProblem.title}
Description: ${currentProblem.description}
Tags: ${currentProblem.tags.join(', ')}
` : '';

  // For now, return a helpful message
  // In production, this could call Gemini with just the problem context
  return `I'd love to help! However, the video transcript isn't available.

Based on the problem "${currentProblem?.title}", I can help with:
- Explaining the approach and algorithm
- Discussing time/space complexity
- Walking through examples
- Clarifying specific concepts

What specific aspect would you like to understand better?`;
}

function addChatMessage(text, sender) {
  const messagesContainer = document.getElementById('chat-messages');
  const messageId = `msg-${Date.now()}`;

  const messageEl = document.createElement('div');
  messageEl.id = messageId;
  messageEl.className = `chat-message ${sender}`;
  messageEl.innerHTML = `
    <div class="chat-avatar">${sender === 'user' ? '👤' : '🤖'}</div>
    <div class="chat-content">${text}</div>
  `;

  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  return messageId;
}

function replaceChatMessage(messageId, newText, sender) {
  const messageEl = document.getElementById(messageId);
  if (messageEl) {
    messageEl.className = `chat-message ${sender}`;
    messageEl.innerHTML = `
      <div class="chat-avatar">${sender === 'user' ? '👤' : '🤖'}</div>
      <div class="chat-content">${newText}</div>
    `;
  }
}

function setupVoiceInput() {
  const micBtn = document.getElementById('chat-mic-btn');

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      micBtn.style.background = '#ef4444';
    };

    recognition.onend = () => {
      micBtn.style.background = '';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      document.getElementById('chat-input').value = transcript;
      sendChatMessage(transcript);
    };

    micBtn.addEventListener('click', () => {
      recognition.start();
    });
  } else {
    micBtn.addEventListener('click', () => {
      alert('Voice recognition is not supported in your browser. Please type your message.');
    });
  }
}
