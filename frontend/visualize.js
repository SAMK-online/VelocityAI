// VelocityAI Visualization Engine
// Handles AI-generated animations for DS/Algo learning

// Dynamic URL detection: works on localhost dev AND Cloud Run
const API_BASE = (window.location.hostname === 'localhost' && window.location.port === '3000')
  ? 'http://localhost:8000'
  : window.location.origin;
const WS_HOST = (window.location.hostname === 'localhost' && window.location.port === '3000')
  ? 'localhost:8000'
  : window.location.host;

class AnimationEngine {
  constructor(svgElement) {
    this.svg = svgElement;
    this.elements = new Map(); // id -> SVG element
    this.state = {
      nodes: new Map(),
      edges: new Map(),
      arrays: new Map(),
      pointers: new Map(),
      labels: new Map()
    };
    this.currentStep = 0;
    this.steps = [];
    this.isPlaying = false;
    this.speed = 1.0;
    this.setupSVG();
  }

  setupSVG() {
    this.svg.setAttribute('viewBox', '0 0 800 600');
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';
  }

  async loadVisualization(visualizationData) {
    this.reset();
    voiceManager.stopAll(); // Stop any playing audio from previous visualization
    this.steps = visualizationData.steps || [];

    // Set metadata
    document.getElementById('viz-title').textContent = visualizationData.topic || 'Visualization';
    const complexity = visualizationData.metadata?.complexity;
    if (complexity) {
      document.getElementById('viz-subtitle').textContent =
        `Time: ${complexity.time}, Space: ${complexity.space}`;
    }

    // Display educational content
    const educational = visualizationData.educational;
    if (educational) {
      this.displayEducationalContent(educational);
    }

    // Process initialState - create nodes and edges
    const initialState = visualizationData.initialState || {};

    // Create initial nodes
    if (initialState.nodes && Array.isArray(initialState.nodes)) {
      console.log('Creating initial nodes:', initialState.nodes.length);
      initialState.nodes.forEach(node => {
        this.createNode(node);
      });
    }

    // Create initial edges
    if (initialState.edges && Array.isArray(initialState.edges)) {
      console.log('Creating initial edges:', initialState.edges.length);
      initialState.edges.forEach(edge => {
        this.createEdge(edge);
      });
    }

    // Show playback controls
    document.getElementById('playback-controls').style.display = 'flex';
    document.getElementById('empty-state').style.display = 'none';
  }

  displayEducationalContent(educational) {
    // Add educational content to the voice conversation area
    const messagesDiv = document.getElementById('messages');

    // Clear previous educational content
    const existingEdu = messagesDiv.querySelector('.educational-content');
    if (existingEdu) existingEdu.remove();

    const eduDiv = document.createElement('div');
    eduDiv.className = 'educational-content';
    eduDiv.style.cssText = 'background: rgba(34, 211, 238, 0.1); border-left: 3px solid #22d3ee; padding: 16px; margin-bottom: 16px; border-radius: 8px;';

    let html = '<div style="color: #22d3ee; font-weight: 600; margin-bottom: 12px;">📚 Educational Content</div>';

    if (educational.definition) {
      html += `<div style="margin-bottom: 12px;"><strong>Definition:</strong> ${educational.definition}</div>`;
    }

    if (educational.keyPoints && educational.keyPoints.length > 0) {
      html += '<div style="margin-bottom: 12px;"><strong>Key Points:</strong><ul style="margin: 8px 0; padding-left: 20px;">';
      educational.keyPoints.forEach(point => {
        html += `<li>${point}</li>`;
      });
      html += '</ul></div>';
    }

    if (educational.whenToUse) {
      html += `<div style="margin-bottom: 12px;"><strong>When to Use:</strong> ${educational.whenToUse}</div>`;
    }

    if (educational.commonProblems && educational.commonProblems.length > 0) {
      html += '<div><strong>Common Problems:</strong><ul style="margin: 8px 0; padding-left: 20px;">';
      educational.commonProblems.forEach(problem => {
        html += `<li>${problem}</li>`;
      });
      html += '</ul></div>';
    }

    eduDiv.innerHTML = html;
    messagesDiv.insertBefore(eduDiv, messagesDiv.firstChild);
  }

  reset() {
    this.svg.innerHTML = '';
    this.elements.clear();
    Object.values(this.state).forEach(map => map.clear());
    this.currentStep = 0;
    this.isPlaying = false;
  }

  async play() {
    if (this.currentStep >= this.steps.length) {
      this.currentStep = 0;
    }

    this.isPlaying = true;
    const playBtn = document.getElementById('btn-play-pause');
    playBtn.textContent = '⏸';

    while (this.isPlaying && this.currentStep < this.steps.length) {
      await this.executeStep(this.currentStep);
      this.currentStep++;

      if (this.currentStep >= this.steps.length) {
        this.pause();
      }
    }
  }

  pause() {
    this.isPlaying = false;
    voiceManager.stopAll(); // Stop audio when pausing
    const playBtn = document.getElementById('btn-play-pause');
    playBtn.textContent = '▶';
  }

  async stepForward() {
    if (this.currentStep < this.steps.length) {
      await this.executeStep(this.currentStep);
      this.currentStep++;
    }
  }

  async stepBackward() {
    if (this.currentStep > 0) {
      this.currentStep--;
      // Replay from beginning to reconstruct state
      await this.restart();
      for (let i = 0; i < this.currentStep; i++) {
        await this.executeStep(i, true); // Skip narration
      }
    }
  }

  async restart() {
    this.pause();
    this.reset();
    await this.loadVisualization({ steps: this.steps });
  }

  async executeStep(stepIndex, skipNarration = false) {
    const step = this.steps[stepIndex];
    if (!step) return;

    // Execute all commands in the step
    const commandPromises = step.commands.map(cmd => this.executeCommand(cmd));
    await Promise.all(commandPromises);

    // Play narration
    if (!skipNarration && step.narration) {
      await this.speak(step.narration);
    }

    // Wait for step duration
    const duration = (step.duration || 2000) / this.speed;
    await this.sleep(duration);
  }

  async executeCommand(command) {
    // Handle both formats:
    // Format 1: { command: "CREATE_NODE", params: {...} }
    // Format 2 (Gemini): { command: "CREATE_NODE", id: "...", value: ... } (flat)
    let cmd = command.command;
    let params = command.params;

    // If params is missing, assume flat format - use command object as params
    if (!params) {
      params = { ...command };
      delete params.command; // Remove command field from params
    }

    console.log('Executing command:', cmd, 'with params:', params);

    if (!cmd) {
      console.warn('Command missing command field:', command);
      return;
    }

    switch (cmd) {
      case 'CREATE_NODE':
        this.createNode(params);
        break;
      case 'UPDATE_NODE':
        this.updateNode(params);
        break;
      case 'DELETE_NODE':
        this.deleteNode(params);
        break;
      case 'MOVE_NODE':
        await this.moveNode(params);
        break;
      case 'HIGHLIGHT':
        this.highlight(params);
        break;
      case 'COMPARE':
        await this.compare(params);
        break;
      case 'PULSE':
        await this.pulse(params);
        break;
      case 'CREATE_EDGE':
        this.createEdge(params);
        break;
      case 'DELETE_EDGE':
        this.deleteEdge(params);
        break;
      case 'HIGHLIGHT_PATH':
        await this.highlightPath(params);
        break;
      case 'CREATE_ARRAY':
        this.createArray(params);
        break;
      case 'SWAP':
        await this.swapArrayElements(params);
        break;
      case 'UPDATE_CELL':
        this.updateArrayCell(params);
        break;
      case 'SET_POINTER':
        this.setPointer(params);
        break;
      case 'ADD_LABEL':
        this.addLabel(params);
        break;
      case 'ADD_ANNOTATION':
        this.addAnnotation(params);
        break;
      default:
        console.warn('Unknown command:', cmd);
    }
  }

  // Node operations
  createNode(params) {
    if (!params || !params.id || !params.position) {
      console.error('createNode: Invalid params', params);
      return;
    }
    const { id, value, position, style } = params;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', id);
    group.setAttribute('transform', `translate(${position.x}, ${position.y})`);

    // Create circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '25');
    circle.setAttribute('fill', style === 'root' ? '#22d3ee' : 'rgba(255, 255, 255, 0.1)');
    circle.setAttribute('stroke', '#22d3ee');
    circle.setAttribute('stroke-width', '2');

    // Create text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-size', '16');
    text.setAttribute('font-weight', '600');
    text.textContent = value;

    group.appendChild(circle);
    group.appendChild(text);
    this.svg.appendChild(group);

    this.elements.set(id, group);
    this.state.nodes.set(id, { value, position, style, circle, text });

    // Animate in
    group.style.opacity = '0';
    group.style.transform = `translate(${position.x}px, ${position.y}px) scale(0.5)`;
    group.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      group.style.opacity = '1';
      group.style.transform = `translate(${position.x}px, ${position.y}px) scale(1)`;
    }, 10);
  }

  updateNode(params) {
    const { id, value, style } = params;
    const nodeState = this.state.nodes.get(id);
    if (!nodeState) return;

    if (value !== undefined) {
      nodeState.text.textContent = value;
      nodeState.value = value;
    }

    if (style) {
      const color = style === 'highlight' ? '#34d399' : '#22d3ee';
      nodeState.circle.setAttribute('fill', `${color}33`);
      nodeState.circle.setAttribute('stroke', color);
    }
  }

  deleteNode(params) {
    const { id, animation = 'fade' } = params;
    const element = this.elements.get(id);
    if (!element) return;

    element.style.transition = 'all 0.3s ease';
    element.style.opacity = '0';
    element.style.transform += ' scale(0.5)';

    setTimeout(() => {
      element.remove();
      this.elements.delete(id);
      this.state.nodes.delete(id);
    }, 300);
  }

  async moveNode(params) {
    const { id, to, duration = 1000, easing = 'ease-in-out' } = params;
    const element = this.elements.get(id);
    if (!element) return;

    element.style.transition = `transform ${duration / 1000}s ${easing}`;
    element.style.transform = `translate(${to.x}px, ${to.y}px)`;

    const nodeState = this.state.nodes.get(id);
    if (nodeState) {
      nodeState.position = to;
    }

    await this.sleep(duration);
  }

  // Visual effects
  highlight(params) {
    const { id, color = '#22d3ee', intensity = 'high', duration = 1000 } = params;
    const element = this.elements.get(id);
    if (!element) return;

    const circle = element.querySelector('circle');
    if (circle) {
      const originalFill = circle.getAttribute('fill');
      const originalStroke = circle.getAttribute('stroke');

      circle.setAttribute('fill', intensity === 'high' ? color : `${color}33`);
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '3');

      setTimeout(() => {
        circle.setAttribute('fill', originalFill);
        circle.setAttribute('stroke', originalStroke);
        circle.setAttribute('stroke-width', '2');
      }, duration);
    }
  }

  async compare(params) {
    const { elements, operator, result } = params;

    // Highlight compared elements
    elements.forEach(id => {
      this.highlight({ id, color: '#fbbf24', intensity: 'medium', duration: 1500 });
    });

    // Show comparison result
    const color = result ? '#34d399' : '#ef4444';
    setTimeout(() => {
      elements.forEach(id => {
        this.highlight({ id, color, intensity: 'high', duration: 800 });
      });
    }, 500);

    await this.sleep(1500);
  }

  async pulse(params) {
    const { id, count = 3, color = '#22d3ee' } = params;
    const element = this.elements.get(id);
    if (!element) return;

    for (let i = 0; i < count; i++) {
      this.highlight({ id, color, intensity: 'high', duration: 400 });
      await this.sleep(400);
    }
  }

  // Edge operations
  createEdge(params) {
    if (!params || !params.id || !params.from || !params.to) {
      console.error('createEdge: Invalid params', params);
      return;
    }
    const { id, from, to, directed = true, weight = null, style = 'solid' } = params;

    const fromNode = this.state.nodes.get(from);
    const toNode = this.state.nodes.get(to);
    if (!fromNode || !toNode) {
      console.warn(`createEdge: Nodes not found - from:${from}, to:${to}`);
      return;
    }

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('id', id);
    line.setAttribute('x1', fromNode.position.x);
    line.setAttribute('y1', fromNode.position.y);
    line.setAttribute('x2', toNode.position.x);
    line.setAttribute('y2', toNode.position.y);
    line.setAttribute('stroke', '#22d3ee');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('opacity', '0.6');

    if (style === 'dashed') {
      line.setAttribute('stroke-dasharray', '5,5');
    }

    // Insert before nodes so edges appear behind
    this.svg.insertBefore(line, this.svg.firstChild);

    this.elements.set(id, line);
    this.state.edges.set(id, { from, to, weight, directed, line });

    // Animate in
    line.style.strokeDasharray = '1000';
    line.style.strokeDashoffset = '1000';
    line.style.transition = 'stroke-dashoffset 0.5s ease';
    setTimeout(() => {
      line.style.strokeDashoffset = '0';
      if (style !== 'dashed') {
        line.style.strokeDasharray = '';
      }
    }, 10);
  }

  deleteEdge(params) {
    const { id } = params;
    const element = this.elements.get(id);
    if (!element) return;

    element.style.transition = 'opacity 0.3s ease';
    element.style.opacity = '0';

    setTimeout(() => {
      element.remove();
      this.elements.delete(id);
      this.state.edges.delete(id);
    }, 300);
  }

  async highlightPath(params) {
    const { nodes, color = '#22d3ee', duration = 2000, sequential = true } = params;

    if (sequential) {
      for (const nodeId of nodes) {
        this.highlight({ id: nodeId, color, intensity: 'high', duration: 800 });
        await this.sleep(300);
      }
    } else {
      nodes.forEach(nodeId => {
        this.highlight({ id: nodeId, color, intensity: 'high', duration });
      });
      await this.sleep(duration);
    }
  }

  // Array operations
  createArray(params) {
    console.log('createArray called with:', JSON.stringify(params, null, 2));
    if (!params || !params.id || !params.values || !params.position) {
      console.error('createArray: Invalid params', params);
      return;
    }
    const { id, values, position } = params;

    const cellWidth = 50;
    const cellHeight = 40;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', id);

    const cells = [];
    values.forEach((value, index) => {
      const x = position.x + (index * cellWidth);
      const y = position.y;

      // Cell background
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', cellWidth);
      rect.setAttribute('height', cellHeight);
      rect.setAttribute('fill', 'rgba(255, 255, 255, 0.05)');
      rect.setAttribute('stroke', '#22d3ee');
      rect.setAttribute('stroke-width', '1');

      // Cell value
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + cellWidth / 2);
      text.setAttribute('y', y + cellHeight / 2);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', '#ffffff');
      text.setAttribute('font-size', '14');
      text.textContent = value;

      // Index label
      const indexText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      indexText.setAttribute('x', x + cellWidth / 2);
      indexText.setAttribute('y', y + cellHeight + 15);
      indexText.setAttribute('text-anchor', 'middle');
      indexText.setAttribute('fill', 'rgba(255, 255, 255, 0.5)');
      indexText.setAttribute('font-size', '11');
      indexText.textContent = index;

      group.appendChild(rect);
      group.appendChild(text);
      group.appendChild(indexText);

      cells.push({ rect, text, value, index });
    });

    this.svg.appendChild(group);
    this.elements.set(id, group);
    this.state.arrays.set(id, { values, position, cells, cellWidth, cellHeight });
  }

  async swapArrayElements(params) {
    const { arrayId, indices, duration = 800 } = params;
    const arrayState = this.state.arrays.get(arrayId);
    if (!arrayState) return;

    const [i, j] = indices;
    const cell1 = arrayState.cells[i];
    const cell2 = arrayState.cells[j];

    // Highlight cells
    cell1.rect.setAttribute('fill', '#fbbf2433');
    cell2.rect.setAttribute('fill', '#fbbf2433');

    // Animate swap
    const text1 = cell1.text;
    const text2 = cell2.text;

    const temp = text1.textContent;
    text1.textContent = text2.textContent;
    text2.textContent = temp;

    cell1.value = text2.textContent;
    cell2.value = text1.textContent;

    await this.sleep(duration);

    // Reset highlight
    cell1.rect.setAttribute('fill', 'rgba(255, 255, 255, 0.05)');
    cell2.rect.setAttribute('fill', 'rgba(255, 255, 255, 0.05)');
  }

  updateArrayCell(params) {
    const { arrayId, index, value, highlight = false } = params;
    const arrayState = this.state.arrays.get(arrayId);
    if (!arrayState || !arrayState.cells[index]) return;

    const cell = arrayState.cells[index];
    cell.text.textContent = value;
    cell.value = value;

    if (highlight) {
      cell.rect.setAttribute('fill', '#34d39933');
      setTimeout(() => {
        cell.rect.setAttribute('fill', 'rgba(255, 255, 255, 0.05)');
      }, 1000);
    }
  }

  setPointer(params) {
    if (!params || !params.id || !params.arrayId || params.index === undefined) {
      console.error('setPointer: Invalid params', params);
      return;
    }
    const { id, arrayId, index, label = '', color = '#22d3ee' } = params;
    const arrayState = this.state.arrays.get(arrayId);
    if (!arrayState) {
      console.warn(`setPointer: Array not found - arrayId:${arrayId}`);
      return;
    }

    // Remove existing pointer if any
    const existing = this.elements.get(id);
    if (existing) existing.remove();

    const cell = arrayState.cells[index];
    if (!cell) return;

    const x = arrayState.position.x + (index * arrayState.cellWidth) + arrayState.cellWidth / 2;
    const y = arrayState.position.y - 20;

    const pointer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pointer.setAttribute('id', id);

    // Arrow
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrow.setAttribute('d', `M ${x} ${y} L ${x} ${y + 15}`);
    arrow.setAttribute('stroke', color);
    arrow.setAttribute('stroke-width', '2');
    arrow.setAttribute('marker-end', 'url(#arrowhead)');

    // Label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y - 5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', color);
    text.setAttribute('font-size', '12');
    text.textContent = label;

    pointer.appendChild(arrow);
    pointer.appendChild(text);
    this.svg.appendChild(pointer);

    this.elements.set(id, pointer);
    this.state.pointers.set(id, { arrayId, index, label, color });
  }

  // Annotations
  addLabel(params) {
    const { id, text, position, style = 'info' } = params;

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('id', id);
    label.setAttribute('x', position.x);
    label.setAttribute('y', position.y);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '14');
    label.setAttribute('font-weight', '500');

    const colors = {
      info: '#22d3ee',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#ef4444'
    };
    label.setAttribute('fill', colors[style] || colors.info);
    label.textContent = text;

    this.svg.appendChild(label);
    this.elements.set(id, label);
    this.state.labels.set(id, { text, position, style });
  }

  addAnnotation(params) {
    const { id, type, from, to, label = '' } = params;

    const annotation = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    annotation.setAttribute('id', id);

    if (type === 'arrow') {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('stroke', '#fbbf24');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '4,4');
      line.setAttribute('marker-end', 'url(#arrowhead)');
      annotation.appendChild(line);

      if (label) {
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX);
        text.setAttribute('y', midY - 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#fbbf24');
        text.setAttribute('font-size', '12');
        text.textContent = label;
        annotation.appendChild(text);
      }
    }

    this.svg.appendChild(annotation);
    this.elements.set(id, annotation);
  }

  // Voice integration
  async speak(text) {
    console.log('🗣️ Speaking:', text);
    // This will be connected to ElevenLabs TTS
    return voiceManager.speak(text);
  }

  // Utilities
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setSpeed(speed) {
    this.speed = speed;
    const display = document.getElementById('speed-display');
    if (display) {
      display.textContent = `${speed}x`;
      console.log(`✅ Speed display updated to ${speed}x`);
    } else {
      console.error('❌ speed-display element not found');
    }
  }
}

// Voice Manager
class VoiceManager {
  constructor() {
    this.audioQueue = [];
    this.isPlaying = false;
    this.currentAudio = null;
  }

  stopAll() {
    // Stop any playing audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // Stop browser speech synthesis
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    console.log('🔇 All audio stopped');
  }

  async speak(text) {
    console.log('🗣️ Speaking:', text);

    try {
      // Use ElevenLabs via backend
      const response = await fetch('${API_BASE}/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;

        return new Promise((resolve) => {
          audio.onended = () => {
            this.currentAudio = null;
            resolve();
          };
          audio.play();
        });
      }
    } catch (err) {
      console.warn('TTS failed, using browser fallback:', err);

      // Fallback to browser TTS
      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onend = resolve;
        speechSynthesis.speak(utterance);
      });
    }
  }
}

// WebSocket Manager
class WebSocketManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connect();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect to backend server on port 8000
    const wsUrl = `${protocol}//${WS_HOST}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      this.reconnectAttempts = 0;
      hideStatus();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.reconnect();
    };
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
    }
  }

  handleMessage(message) {
    console.log('📨 Received:', message.type);

    switch (message.type) {
      case 'visualization_response':
        hideStatus();
        handleVisualizationResponse(message.data);
        break;

      case 'llm_message':
        addMessage(message.text, 'ai');
        break;

      case 'status':
        if (message.message === 'generating_visualization') {
          showStatus('Generating visualization...');
        }
        break;

      case 'error':
        hideStatus();
        console.error('❌ Error from server:', message.message);
        addMessage(`Error: ${message.message}`, 'ai');
        break;
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  requestVisualization(request, context = null) {
    this.send({
      type: 'visualization_request',
      request: request,
      context: context
    });
  }
}

// Global instances
let animationEngine;
let voiceManager;
let wsManager;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  const svgCanvas = document.getElementById('viz-canvas');
  animationEngine = new AnimationEngine(svgCanvas);
  voiceManager = new VoiceManager();
  wsManager = new WebSocketManager();

  setupEventListeners();
  setupArrowMarker();
});

function setupEventListeners() {
  // Topic selection
  document.querySelectorAll('.topic-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.topic-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const topic = item.dataset.topic;
      const title = item.querySelector('.topic-item-title').textContent;
      requestTopicVisualization(topic, title);
    });
  });

  // Playback controls
  document.getElementById('btn-play-pause').addEventListener('click', () => {
    if (animationEngine.isPlaying) {
      animationEngine.pause();
    } else {
      animationEngine.play();
    }
  });

  document.getElementById('btn-step-forward').addEventListener('click', () => {
    animationEngine.stepForward();
  });

  document.getElementById('btn-step-back').addEventListener('click', () => {
    animationEngine.stepBackward();
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    animationEngine.restart();
  });

  document.getElementById('btn-speed').addEventListener('click', () => {
    const speeds = [0.5, 1.0, 1.5, 2.0];
    const currentIndex = speeds.indexOf(animationEngine.speed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    console.log(`⚡ Speed changed: ${animationEngine.speed}x → ${nextSpeed}x`);
    animationEngine.setSpeed(nextSpeed);
  });

  // Text input
  document.getElementById('text-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const input = e.target.value.trim();
      if (input) {
        sendUserMessage(input);
        e.target.value = '';
      }
    }
  });

  // Voice recording
  setupVoiceRecording();
}

function setupArrowMarker() {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrowhead');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');

  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '0 0, 10 3, 0 6');
  polygon.setAttribute('fill', '#22d3ee');

  marker.appendChild(polygon);
  defs.appendChild(marker);
  animationEngine.svg.appendChild(defs);
}

function requestTopicVisualization(topic, title) {
  const requests = {
    'array-basics': `Show me fundamental array operations: creation, indexing, insertion, deletion, and traversal using array [1, 2, 3, 4, 5]. Include definition of arrays and when to use them.`,
    'linked-list': `Visualize linked list insertion and reversal with nodes 1, 2, 3, 4`,
    'stack-queue': `Show me stack push/pop and queue enqueue/dequeue operations`,
    'binary-tree': `Demonstrate binary tree traversal (inorder, preorder, postorder)`,
    'bst': `Show me binary search tree insertion for values 15, 10, 20, 8, 12`,
    'graph': `Visualize a graph and show BFS traversal`,
    'bubble-sort': `Show me bubble sort step-by-step on array [5, 2, 8, 1, 9]`,
    'merge-sort': `Visualize merge sort divide and conquer on [5, 2, 8, 1]`,
    'quick-sort': `Show me quick sort with partitioning on [5, 2, 8, 1, 9]`,
    'binary-search': `Demonstrate binary search for value 7 in sorted array [1, 3, 5, 7, 9, 11]`,
    'bfs': `Show me breadth-first search on a sample graph`,
    'dfs': `Visualize depth-first search on a sample graph`,

    // Patterns
    'two-pointers': `Show me the two pointers pattern for finding pair sum in array [1, 2, 3, 4, 5, 6] with target 7`,
    'sliding-window': `Demonstrate sliding window pattern to find maximum sum subarray of size 3 in [2, 1, 5, 1, 3, 2]`,
    'fast-slow-pointers': `Visualize fast and slow pointers for cycle detection in a linked list`,
    'merge-intervals': `Show me how to merge overlapping intervals: [[1,3], [2,6], [8,10], [15,18]]`,
    'backtracking': `Demonstrate backtracking pattern with N-Queens problem for n=4`,
    'dynamic-programming': `Visualize dynamic programming with Fibonacci sequence using memoization`
  };

  const request = requests[topic] || `Show me ${title}`;
  addMessage(request, 'user');
  showStatus('Generating visualization...');
  wsManager.requestVisualization(request);
}

function sendUserMessage(text) {
  addMessage(text, 'user');
  showStatus('Generating visualization...');
  wsManager.requestVisualization(text);
}

async function handleVisualizationResponse(data) {
  console.log('📊 Visualization data received:', data);
  console.log('📊 Full JSON:', JSON.stringify(data, null, 2));
  await animationEngine.loadVisualization(data);

  // Auto-play
  setTimeout(() => {
    animationEngine.play();
  }, 500);
}

function addMessage(text, sender) {
  const messagesDiv = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;

  messageDiv.innerHTML = `
    <div class="message-avatar">${sender === 'user' ? '👤' : '🤖'}</div>
    <div class="message-content">${text}</div>
  `;

  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showStatus(text) {
  const indicator = document.getElementById('status-indicator');
  document.getElementById('status-text').textContent = text;
  indicator.style.display = 'flex';
}

function hideStatus() {
  document.getElementById('status-indicator').style.display = 'none';
}

// Voice recording (simplified - can be enhanced with Web Speech API)
function setupVoiceRecording() {
  const micBtn = document.getElementById('mic-btn');
  let recognition;

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      micBtn.classList.add('recording');
    };

    recognition.onend = () => {
      micBtn.classList.remove('recording');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      document.getElementById('text-input').value = transcript;
      sendUserMessage(transcript);
    };

    micBtn.addEventListener('click', () => {
      if (micBtn.classList.contains('recording')) {
        recognition.stop();
      } else {
        recognition.start();
      }
    });
  } else {
    micBtn.addEventListener('click', () => {
      alert('Voice recognition is not supported in your browser. Please type your message instead.');
    });
  }
}
