class InvestigationDashboard {
  constructor() {
    this.investigation = null;
    this.canvas = null;
    this.ctx = null;
    this.nodes = [];
    this.edges = [];
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.selectedNode = null;
    this.draggingNode = null;
    this.isPanning = false;
    this.lastMouse = { x: 0, y: 0 };

    // Relationship creation mode
    this.addRelationshipMode = false;
    this.relationshipSourceNode = null;

    // Chat state
    this.currentConversation = null;
    this.conversations = [];

    this.init();
  }

  async init() {
    // Get investigation ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const investigationId = urlParams.get('id');

    if (!investigationId) {
      alert('No investigation ID provided');
      return;
    }

    // Load investigation
    this.investigation = await Store.getInvestigation(investigationId);

    if (!this.investigation) {
      alert('Investigation not found');
      return;
    }

    // Set up UI
    document.getElementById('investigation-title').textContent = `🕸️ ${this.investigation.title}`;
    this.updateStats();
    this.setupCanvas();
    this.bindEvents();
    await this.loadConversations();
    this.prepareGraphData();
    this.layoutGraph();
    this.render();
  }

  updateStats() {
    document.getElementById('stat-entities').textContent = this.investigation.entities.length;
    document.getElementById('stat-relationships').textContent = this.investigation.relationships.length;
    document.getElementById('stat-captures').textContent = this.investigation.captures.length;
  }

  setupCanvas() {
    const container = document.getElementById('graph-container');
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.render();
  }

  bindEvents() {
    document.getElementById('btn-fit-graph').addEventListener('click', () => this.fitView());
    document.getElementById('btn-refresh').addEventListener('click', () => location.reload());
    document.getElementById('btn-close-panel').addEventListener('click', () => {
      document.getElementById('entity-panel').classList.add('hidden');
    });

    // Chat panel
    document.getElementById('btn-toggle-chat').addEventListener('click', () => this.toggleChatPanel());
    document.getElementById('btn-close-chat').addEventListener('click', () => this.toggleChatPanel());
    document.getElementById('btn-send-chat').addEventListener('click', () => this.sendChatMessage());
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendChatMessage();
      }
    });

    // Conversation management
    document.getElementById('conversation-select').addEventListener('change', (e) => {
      this.switchConversation(e.target.value);
    });
    document.getElementById('btn-new-conversation').addEventListener('click', () => {
      this.createNewConversation();
    });
    document.getElementById('btn-delete-conversation').addEventListener('click', () => {
      this.deleteCurrentConversation();
    });

    // Add entity
    document.getElementById('btn-add-entity').addEventListener('click', () => {
      this.openEntityModal();
    });

    // Entity modal
    document.getElementById('btn-close-entity-modal').addEventListener('click', () => this.closeEntityModal());
    document.getElementById('btn-cancel-entity').addEventListener('click', () => this.closeEntityModal());
    document.getElementById('btn-save-entity').addEventListener('click', () => this.saveEntity());

    // Entity type change - show/hide source fields
    document.getElementById('entity-type').addEventListener('change', (e) => {
      const sourceFields = document.getElementById('source-fields');
      if (e.target.value === 'source') {
        sourceFields.classList.remove('hidden');
        // Set default date to today
        document.getElementById('source-collected').valueAsDate = new Date();
      } else {
        sourceFields.classList.add('hidden');
      }
    });

    // Add relationship mode
    document.getElementById('btn-add-relationship').addEventListener('click', () => {
      this.toggleAddRelationshipMode();
    });

    // Relationship modal
    document.getElementById('btn-close-modal').addEventListener('click', () => this.closeRelationshipModal());
    document.getElementById('btn-cancel-relationship').addEventListener('click', () => this.closeRelationshipModal());
    document.getElementById('btn-save-relationship').addEventListener('click', () => this.saveRelationship());

    // Confidence slider
    document.getElementById('rel-confidence').addEventListener('input', (e) => {
      document.getElementById('confidence-value').textContent = e.target.value;
    });

    // Add source to relationship
    document.getElementById('btn-add-source-to-rel').addEventListener('click', () => {
      this.addSourceToRelationship();
    });

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
    this.canvas.addEventListener('click', (e) => this.onClick(e));
  }

  prepareGraphData() {
    // Create nodes from entities
    this.nodes = this.investigation.entities.map(entity => ({
      id: entity.id,
      label: entity.name,
      x: Math.random() * 800 - 400,
      y: Math.random() * 600 - 300,
      vx: 0,
      vy: 0,
      radius: 15 + (entity.occurrences.length * 3),
      color: this.getEntityColor(entity.type),
      data: entity
    }));

    // Create edges from relationships
    this.edges = this.investigation.relationships.map(rel => ({
      source: this.nodes.find(n => n.id === rel.sourceId),
      target: this.nodes.find(n => n.id === rel.targetId),
      label: rel.type,
      width: 1 + (rel.confidence * 2),
      data: rel
    })).filter(e => e.source && e.target);
  }

  layoutGraph() {
    // Simple force-directed layout
    const iterations = 100;
    const k = 100; // Ideal spring length
    const c = 0.01; // Repulsion strength

    for (let iter = 0; iter < iterations; iter++) {
      // Reset forces
      this.nodes.forEach(n => {
        n.fx = 0;
        n.fy = 0;
      });

      // Repulsion between all nodes
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const n1 = this.nodes[i];
          const n2 = this.nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = c * k * k / dist;

          n1.fx -= force * dx / dist;
          n1.fy -= force * dy / dist;
          n2.fx += force * dx / dist;
          n2.fy += force * dy / dist;
        }
      }

      // Attraction along edges
      this.edges.forEach(edge => {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - k) * 0.1;

        edge.source.fx += force * dx / dist;
        edge.source.fy += force * dy / dist;
        edge.target.fx -= force * dx / dist;
        edge.target.fy -= force * dy / dist;
      });

      // Apply forces
      this.nodes.forEach(n => {
        n.x += n.fx;
        n.y += n.fy;
      });
    }
  }

  fitView() {
    if (this.nodes.length === 0) return;

    const padding = 100;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    this.nodes.forEach(n => {
      minX = Math.min(minX, n.x - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    });

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const canvasWidth = this.canvas.width / window.devicePixelRatio;
    const canvasHeight = this.canvas.height / window.devicePixelRatio;

    const zoom = Math.min(
      (canvasWidth - padding * 2) / graphWidth,
      (canvasHeight - padding * 2) / graphHeight,
      2 // Max zoom
    );

    this.camera.zoom = zoom;
    this.camera.x = -(minX + maxX) / 2 * zoom + canvasWidth / 2;
    this.camera.y = -(minY + maxY) / 2 * zoom + canvasHeight / 2;

    this.render();
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.camera.x) / this.camera.zoom,
      y: (screenY - this.camera.y) / this.camera.zoom
    };
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.camera.zoom + this.camera.x,
      y: worldY * this.camera.zoom + this.camera.y
    };
  }

  getNodeAt(x, y) {
    const world = this.screenToWorld(x, y);
    return this.nodes.find(n => {
      const dx = n.x - world.x;
      const dy = n.y - world.y;
      return Math.sqrt(dx * dx + dy * dy) < n.radius;
    });
  }

  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = this.getNodeAt(x, y);
    if (node) {
      this.draggingNode = node;
    } else {
      this.isPanning = true;
    }

    this.lastMouse = { x, y };
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - this.lastMouse.x;
    const dy = y - this.lastMouse.y;

    if (this.draggingNode) {
      const world = this.screenToWorld(x, y);
      this.draggingNode.x = world.x;
      this.draggingNode.y = world.y;
      this.render();
    } else if (this.isPanning) {
      this.camera.x += dx;
      this.camera.y += dy;
      this.render();
    }

    this.lastMouse = { x, y };
  }

  onMouseUp(e) {
    this.draggingNode = null;
    this.isPanning = false;
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, this.camera.zoom * zoomFactor));

    // Zoom towards mouse position
    this.camera.x = x - (x - this.camera.x) * (newZoom / this.camera.zoom);
    this.camera.y = y - (y - this.camera.y) * (newZoom / this.camera.zoom);
    this.camera.zoom = newZoom;

    this.render();
  }

  onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = this.getNodeAt(x, y);

    // Handle relationship creation mode
    if (this.addRelationshipMode && node) {
      if (!this.relationshipSourceNode) {
        // First click - select source
        this.relationshipSourceNode = node;
        this.selectedNode = node;
        this.render();
      } else if (node !== this.relationshipSourceNode) {
        // Second click - select target and open modal
        this.openRelationshipModal(this.relationshipSourceNode, node);
      }
      return;
    }

    // Normal selection mode
    if (node) {
      this.selectedNode = node;
      this.showEntityDetails(node.data);
      this.render();
    } else {
      this.selectedNode = null;
      document.getElementById('entity-panel').classList.add('hidden');
      this.render();
    }
  }

  render() {
    const w = this.canvas.width / window.devicePixelRatio;
    const h = this.canvas.height / window.devicePixelRatio;

    this.ctx.clearRect(0, 0, w, h);

    // Draw edges
    this.edges.forEach(edge => {
      const from = this.worldToScreen(edge.source.x, edge.source.y);
      const to = this.worldToScreen(edge.target.x, edge.target.y);

      this.ctx.strokeStyle = 'rgba(108, 114, 203, 0.4)';
      this.ctx.lineWidth = edge.width;
      this.ctx.beginPath();
      this.ctx.moveTo(from.x, from.y);
      this.ctx.lineTo(to.x, to.y);
      this.ctx.stroke();

      // Draw arrow
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const arrowLen = 10;
      const endX = to.x - Math.cos(angle) * edge.target.radius;
      const endY = to.y - Math.sin(angle) * edge.target.radius;

      this.ctx.fillStyle = 'rgba(108, 114, 203, 0.6)';
      this.ctx.beginPath();
      this.ctx.moveTo(endX, endY);
      this.ctx.lineTo(
        endX - arrowLen * Math.cos(angle - Math.PI / 6),
        endY - arrowLen * Math.sin(angle - Math.PI / 6)
      );
      this.ctx.lineTo(
        endX - arrowLen * Math.cos(angle + Math.PI / 6),
        endY - arrowLen * Math.sin(angle + Math.PI / 6)
      );
      this.ctx.closePath();
      this.ctx.fill();

      // Draw label
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      this.ctx.fillStyle = '#9498b0';
      this.ctx.font = '10px -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'bottom';
      this.ctx.fillText(edge.label, midX, midY - 5);
    });

    // Draw nodes
    this.nodes.forEach(node => {
      const screen = this.worldToScreen(node.x, node.y);
      const radius = node.radius * this.camera.zoom;

      // Highlight if selected or source node in relationship mode
      if (node === this.selectedNode || node === this.relationshipSourceNode) {
        this.ctx.strokeStyle = this.addRelationshipMode && node === this.relationshipSourceNode ? '#4caf7c' : '#ffffff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, radius + 5, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Node circle
      this.ctx.fillStyle = node.color;
      this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Node label
      this.ctx.fillStyle = '#e4e6f0';
      this.ctx.font = '12px -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(node.label, screen.x, screen.y + radius + 5);
    });

    // Show instruction if in add relationship mode
    if (this.addRelationshipMode) {
      const instruction = this.relationshipSourceNode
        ? 'Click target node to create relationship'
        : 'Click source node to start';

      this.ctx.fillStyle = 'rgba(76, 175, 124, 0.9)';
      this.ctx.font = '14px -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(instruction, w / 2, 20);
    }
  }

  getEntityColor(type) {
    const colors = {
      person: '#e05555',
      organization: '#4a9ede',
      location: '#4caf7c',
      financial: '#e8a838',
      date: '#9c6ade',
      identifier: '#6b6f8a',
      asset: '#d4785c',
      event: '#57b5b5',
      source: '#f4a261'
    };
    return colors[type] || '#6b6f8a';
  }

  toggleChatPanel() {
    const panel = document.getElementById('chat-panel');
    const isHidden = panel.classList.contains('hidden');

    if (isHidden) {
      panel.classList.remove('hidden');
      document.getElementById('chat-input').focus();
    } else {
      panel.classList.add('hidden');
    }
  }

  async loadConversations() {
    this.conversations = await Store.getConversationList(this.investigation.id);
    this.updateConversationSelect();
  }

  updateConversationSelect() {
    const select = document.getElementById('conversation-select');
    select.innerHTML = '<option value="">New Conversation</option>';

    this.conversations
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .forEach(conv => {
        const option = document.createElement('option');
        option.value = conv.id;
        option.textContent = `${conv.title} (${conv.messageCount} msgs)`;
        if (this.currentConversation && conv.id === this.currentConversation.id) {
          option.selected = true;
        }
        select.appendChild(option);
      });
  }

  async createNewConversation() {
    // Save current conversation if exists
    if (this.currentConversation) {
      await this.saveCurrentConversation();
    }

    // Create new conversation
    this.currentConversation = Schema.createConversation({
      investigationId: this.investigation.id,
      title: 'New Conversation'
    });

    // Clear chat messages
    document.getElementById('chat-messages').innerHTML = `
      <div class="chat-message system">
        Ask me questions about your investigation graph. I can:
        <ul>
          <li>Answer questions based on entities and relationships</li>
          <li>Find connections between entities</li>
          <li>Infer new relationships from existing data</li>
          <li>Add, update, or remove entities and relationships</li>
          <li>Maintain graph quality and consistency</li>
        </ul>
      </div>
    `;

    // Update select
    document.getElementById('conversation-select').value = '';
    document.getElementById('chat-input').focus();
  }

  async switchConversation(conversationId) {
    // Save current conversation
    if (this.currentConversation) {
      await this.saveCurrentConversation();
    }

    if (!conversationId) {
      this.createNewConversation();
      return;
    }

    // Load selected conversation
    this.currentConversation = await Store.getConversation(conversationId);

    if (!this.currentConversation) {
      this.createNewConversation();
      return;
    }

    // Render messages
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    this.currentConversation.messages.forEach(msg => {
      this.renderMessage(msg);
    });

    container.scrollTop = container.scrollHeight;
  }

  async deleteCurrentConversation() {
    if (!this.currentConversation || !this.currentConversation.id.startsWith('conv_')) {
      alert('No conversation to delete');
      return;
    }

    if (!confirm('Delete this conversation? This cannot be undone.')) {
      return;
    }

    await Store.deleteConversation(this.currentConversation.id);
    await this.loadConversations();
    this.createNewConversation();
  }

  async saveCurrentConversation() {
    if (!this.currentConversation) return;

    // Auto-generate title from first user message if still "New Conversation"
    if (this.currentConversation.title === 'New Conversation' && this.currentConversation.messages.length > 0) {
      const firstUserMsg = this.currentConversation.messages.find(m => m.type === 'user');
      if (firstUserMsg) {
        this.currentConversation.title = firstUserMsg.content.substring(0, 50) +
          (firstUserMsg.content.length > 50 ? '...' : '');
      }
    }

    await Store.saveConversation(this.currentConversation);
    await this.loadConversations();
  }

  async sendChatMessage() {
    const input = document.getElementById('chat-input');
    const question = input.value.trim();

    if (!question) return;

    // Ensure we have a conversation
    if (!this.currentConversation) {
      this.currentConversation = Schema.createConversation({
        investigationId: this.investigation.id,
        title: 'New Conversation'
      });
    }

    // Add user message
    const userMessage = Schema.createMessage({
      type: 'user',
      content: question
    });
    this.currentConversation.messages.push(userMessage);
    this.renderMessage(userMessage);

    input.value = '';

    // Add loading message
    const loadingId = this.addChatMessage('loading', 'Analyzing graph...');

    try {
      // Build graph context
      const graphContext = this.buildGraphContext();

      // Get settings for LLM
      const settings = await Store.getSettings();

      if (!settings.apiKey && settings.llmProvider === 'openai') {
        this.removeChatMessage(loadingId);
        this.addChatMessage('assistant', 'Error: Please configure your API key in the popup settings.');
        return;
      }

      // Call LLM
      const result = await this.queryGraphWithLLM(question, graphContext, settings);

      // Remove loading message
      this.removeChatMessage(loadingId);

      // Create assistant message
      const assistantMessage = Schema.createMessage({
        type: 'assistant',
        content: result.answer,
        reasoning: result.reasoning,
        actions: result.actions
      });
      this.currentConversation.messages.push(assistantMessage);
      this.renderMessage(assistantMessage);

      // Execute actions
      if (result.actions && result.actions.length > 0) {
        await this.executeActions(result.actions);
      }

      // Save conversation
      await this.saveCurrentConversation();

    } catch (err) {
      this.removeChatMessage(loadingId);

      const errorMessage = Schema.createMessage({
        type: 'assistant',
        content: `Error: ${err.message}`
      });
      this.currentConversation.messages.push(errorMessage);
      this.renderMessage(errorMessage);

      await this.saveCurrentConversation();
    }
  }

  buildGraphContext() {
    return {
      entities: this.investigation.entities.map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        aliases: e.aliases,
        attributes: e.attributes,
        occurrences: e.occurrences.length,
        sourceLinks: e.sourceLinks || []
      })),
      relationships: this.investigation.relationships.map(r => {
        const source = this.investigation.entities.find(e => e.id === r.sourceId);
        const target = this.investigation.entities.find(e => e.id === r.targetId);
        return {
          id: r.id,
          source: source?.name,
          target: target?.name,
          type: r.type,
          confidence: r.confidence,
          sourcesSupporting: r.sourcesSupporting || []
        };
      }),
      sources: this.investigation.entities
        .filter(e => e.type === 'source')
        .map(s => ({
          id: s.id,
          name: s.name,
          url: s.attributes?.url,
          dateCollected: s.attributes?.dateCollected
        }))
    };
  }

  // Helper: Fuzzy match entity name (handles spelling variations)
  fuzzyMatchEntity(searchName) {
    const normalized = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const searchNorm = normalized(searchName);

    // Try exact match first (case insensitive)
    let match = this.investigation.entities.find(e =>
      e.name.toLowerCase() === searchName.toLowerCase() ||
      e.aliases.some(a => a.toLowerCase() === searchName.toLowerCase())
    );

    if (match) return match;

    // Try normalized match (removes punctuation, spaces)
    match = this.investigation.entities.find(e =>
      normalized(e.name) === searchNorm ||
      e.aliases.some(a => normalized(a) === searchNorm)
    );

    if (match) return match;

    // Try partial match (contains)
    match = this.investigation.entities.find(e =>
      normalized(e.name).includes(searchNorm) ||
      searchNorm.includes(normalized(e.name)) ||
      e.aliases.some(a => normalized(a).includes(searchNorm) || searchNorm.includes(normalized(a)))
    );

    if (match) return match;

    // Try similarity matching (simple Levenshtein-like approach)
    const similarity = (s1, s2) => {
      const longer = s1.length > s2.length ? s1 : s2;
      const shorter = s1.length > s2.length ? s2 : s1;
      if (longer.length === 0) return 1.0;

      const editDistance = this.levenshteinDistance(longer, shorter);
      return (longer.length - editDistance) / longer.length;
    };

    const candidates = this.investigation.entities.map(e => ({
      entity: e,
      score: Math.max(
        similarity(searchNorm, normalized(e.name)),
        ...e.aliases.map(a => similarity(searchNorm, normalized(a)))
      )
    })).filter(c => c.score > 0.6); // 60% similarity threshold

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0].entity;
    }

    return null;
  }

  levenshteinDistance(s1, s2) {
    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[s2.length][s1.length];
  }

  // Graph query tools for AI
  findShortestPath(sourceName, targetName) {
    // Find entities by name (with fuzzy matching)
    const sourceEntity = this.fuzzyMatchEntity(sourceName);
    const targetEntity = this.fuzzyMatchEntity(targetName);

    if (!sourceEntity) {
      return {
        error: `Source entity not found: "${sourceName}". Available entities: ${this.investigation.entities.slice(0, 10).map(e => e.name).join(', ')}${this.investigation.entities.length > 10 ? '...' : ''}`,
        path: null
      };
    }

    if (!targetEntity) {
      return {
        error: `Target entity not found: "${targetName}". Available entities: ${this.investigation.entities.slice(0, 10).map(e => e.name).join(', ')}${this.investigation.entities.length > 10 ? '...' : ''}`,
        path: null
      };
    }

    if (sourceEntity.id === targetEntity.id) {
      return {
        path: [{ entity: sourceEntity.name, relationships: [] }],
        length: 0,
        source: sourceEntity.name,
        target: targetEntity.name,
        note: sourceEntity.name !== sourceName || targetEntity.name !== targetName
          ? `Note: Fuzzy matched "${sourceName}" to "${sourceEntity.name}" and "${targetName}" to "${targetEntity.name}"`
          : null
      };
    }

    // Build adjacency list
    const adjacency = new Map();
    this.investigation.entities.forEach(e => adjacency.set(e.id, []));

    this.investigation.relationships.forEach(rel => {
      if (!adjacency.has(rel.sourceId)) adjacency.set(rel.sourceId, []);
      if (!adjacency.has(rel.targetId)) adjacency.set(rel.targetId, []);

      adjacency.get(rel.sourceId).push({
        entityId: rel.targetId,
        relationship: rel
      });
      // Also add reverse direction for undirected traversal
      adjacency.get(rel.targetId).push({
        entityId: rel.sourceId,
        relationship: { ...rel, reversed: true }
      });
    });

    // BFS to find shortest path
    const queue = [{ entityId: sourceEntity.id, path: [sourceEntity.id], relationships: [] }];
    const visited = new Set([sourceEntity.id]);

    while (queue.length > 0) {
      const current = queue.shift();

      if (current.entityId === targetEntity.id) {
        // Build path with entity names and relationships
        const pathWithNames = [];
        for (let i = 0; i < current.path.length; i++) {
          const entity = this.investigation.entities.find(e => e.id === current.path[i]);
          const rels = i < current.relationships.length ? [current.relationships[i]] : [];
          pathWithNames.push({
            entity: entity.name,
            type: entity.type,
            relationships: rels
          });
        }

        return {
          path: pathWithNames,
          length: current.relationships.length,
          source: sourceEntity.name,
          target: targetEntity.name,
          searchedFor: { source: sourceName, target: targetName },
          note: sourceEntity.name !== sourceName || targetEntity.name !== targetName
            ? `Fuzzy matched "${sourceName}" → "${sourceEntity.name}" and "${targetName}" → "${targetEntity.name}"`
            : null
        };
      }

      const neighbors = adjacency.get(current.entityId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.entityId)) {
          visited.add(neighbor.entityId);

          const sourceEntity = this.investigation.entities.find(e => e.id === current.entityId);
          const targetEntity = this.investigation.entities.find(e => e.id === neighbor.entityId);

          const relInfo = {
            from: neighbor.relationship.reversed ? targetEntity.name : sourceEntity.name,
            to: neighbor.relationship.reversed ? sourceEntity.name : targetEntity.name,
            type: neighbor.relationship.type,
            confidence: neighbor.relationship.confidence,
            explanation: neighbor.relationship.attributes?.explanation || ''
          };

          queue.push({
            entityId: neighbor.entityId,
            path: [...current.path, neighbor.entityId],
            relationships: [...current.relationships, relInfo]
          });
        }
      }
    }

    return { error: 'No path found between entities', path: null };
  }

  getEntityDetails(entityName) {
    const entity = this.fuzzyMatchEntity(entityName);

    if (!entity) {
      return { error: `Entity not found: "${entityName}". Available entities: ${this.investigation.entities.slice(0, 10).map(e => e.name).join(', ')}${this.investigation.entities.length > 10 ? '...' : ''}` };
    }

    // Get all relationships
    const relationships = this.investigation.relationships.filter(r =>
      r.sourceId === entity.id || r.targetId === entity.id
    ).map(r => {
      const isSource = r.sourceId === entity.id;
      const otherId = isSource ? r.targetId : r.sourceId;
      const otherEntity = this.investigation.entities.find(e => e.id === otherId);

      return {
        from: isSource ? entity.name : otherEntity?.name,
        to: isSource ? otherEntity?.name : entity.name,
        type: r.type,
        confidence: r.confidence,
        explanation: r.attributes?.explanation || '',
        sourcesSupporting: r.sourcesSupporting || []
      };
    });

    // Get sources
    const sources = (entity.sourceLinks || []).map(link => {
      const source = this.investigation.entities.find(e => e.id === link.sourceId);
      return {
        name: source?.name,
        description: link.description,
        url: source?.attributes?.url
      };
    });

    return {
      name: entity.name,
      type: entity.type,
      aliases: entity.aliases,
      attributes: entity.attributes,
      relationships: relationships,
      sources: sources,
      notes: entity.notes,
      occurrences: entity.occurrences.length,
      searchedFor: entityName,
      note: entity.name.toLowerCase() !== entityName.toLowerCase()
        ? `Fuzzy matched "${entityName}" to "${entity.name}"`
        : null
    };
  }

  getRelatedEntities(entityName, maxDepth = 2) {
    const entity = this.fuzzyMatchEntity(entityName);

    if (!entity) {
      return { error: `Entity not found: "${entityName}"` };
    }

    // BFS to find entities within maxDepth hops
    const queue = [{ entityId: entity.id, depth: 0 }];
    const visited = new Map([[entity.id, 0]]);
    const related = [];

    while (queue.length > 0) {
      const current = queue.shift();

      if (current.depth > 0) {
        const ent = this.investigation.entities.find(e => e.id === current.entityId);
        related.push({
          name: ent.name,
          type: ent.type,
          depth: current.depth
        });
      }

      if (current.depth >= maxDepth) continue;

      // Find connected entities
      this.investigation.relationships.forEach(rel => {
        let nextId = null;
        if (rel.sourceId === current.entityId) nextId = rel.targetId;
        if (rel.targetId === current.entityId) nextId = rel.sourceId;

        if (nextId && (!visited.has(nextId) || visited.get(nextId) > current.depth + 1)) {
          visited.set(nextId, current.depth + 1);
          queue.push({ entityId: nextId, depth: current.depth + 1 });
        }
      });
    }

    return {
      entity: entity.name,
      relatedEntities: related,
      totalFound: related.length,
      searchedFor: entityName,
      note: entity.name.toLowerCase() !== entityName.toLowerCase()
        ? `Fuzzy matched "${entityName}" to "${entity.name}"`
        : null
    };
  }

  // Web research tools
  async searchGoogle(query, apiKey, searchEngineId) {
    if (!apiKey || !searchEngineId) {
      return {
        error: 'Google Search API key or Custom Search Engine ID not configured. Please add them in settings.'
      };
    }

    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=5`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        return {
          error: `Google Search API error: ${errorData.error?.message || response.statusText}`
        };
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        return {
          results: [],
          message: 'No results found'
        };
      }

      const results = data.items.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        displayLink: item.displayLink
      }));

      return {
        query: query,
        results: results,
        totalResults: data.searchInformation?.totalResults || 0
      };
    } catch (err) {
      return {
        error: `Search failed: ${err.message}`
      };
    }
  }

  async scrapeWebpage(url, apiKey) {
    if (!apiKey) {
      return {
        error: 'Firecrawl API key not configured. Please add it in settings.'
      };
    }

    try {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url,
          formats: ['markdown'],
          onlyMainContent: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          error: `Firecrawl API error: ${errorData.error || response.statusText}`
        };
      }

      const data = await response.json();

      if (!data.success) {
        return {
          error: 'Failed to scrape webpage'
        };
      }

      return {
        url: url,
        title: data.data?.metadata?.title || url,
        content: data.data?.markdown || data.data?.content || '',
        metadata: {
          description: data.data?.metadata?.description,
          author: data.data?.metadata?.author,
          publishedDate: data.data?.metadata?.publishedDate
        }
      };
    } catch (err) {
      return {
        error: `Scraping failed: ${err.message}`
      };
    }
  }

  async extractEntitiesFromText(text, sourceUrl, settings) {
    const endpoint = settings.endpoint || 'https://api.openai.com';
    const model = settings.model || 'gpt-4o';
    const apiKey = settings.apiKey;

    if (!apiKey) {
      return { error: 'OpenAI API key not configured' };
    }

    // Truncate text if too long (to avoid token limits)
    const maxChars = 10000;
    const truncatedText = text.length > maxChars ? text.substring(0, maxChars) + '\n\n[...truncated]' : text;

    const prompt = `Extract entities and relationships from the following text. Focus on people, organizations, locations, financial information, and their connections.

TEXT:
${truncatedText}

SOURCE URL: ${sourceUrl}

Extract entities and relationships following these rules:
1. Identify key entities (people, organizations, locations, financial entities)
2. Identify relationships between entities
3. Be conservative - only extract clear, factual information
4. Include confidence scores based on how explicit the information is

Return a JSON object with this structure:
{
  "entities": [
    {
      "name": "Entity Name",
      "type": "person|organization|location|financial|date|asset|event",
      "aliases": ["alternate names"],
      "attributes": {},
      "sourceDescription": "What this text says about this entity"
    }
  ],
  "relationships": [
    {
      "source": "Entity A name",
      "target": "Entity B name",
      "type": "relationship_type (e.g., works_for, owns, director_of)",
      "sourceExplanation": "How this text proves/supports this relationship",
      "confidence": 0.0-1.0
    }
  ]
}`;

    try {
      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2
        })
      });

      if (!response.ok) {
        return { error: `LLM API error: ${response.status}` };
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      let extraction;
      try {
        extraction = JSON.parse(content);
      } catch (e) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extraction = JSON.parse(jsonMatch[0]);
        } else {
          return { error: 'Failed to parse extraction response' };
        }
      }

      return {
        entities: extraction.entities || [],
        relationships: extraction.relationships || [],
        sourceUrl: sourceUrl
      };
    } catch (err) {
      return { error: `Extraction failed: ${err.message}` };
    }
  }

  async addToGraphFromWeb(data) {
    try {
      // Create Source entity
      const sourceEntity = Schema.createEntity({
        name: data.source_name,
        type: 'source',
        attributes: {
          url: data.source_url,
          dateCollected: new Date().toISOString().split('T')[0]
        },
        flags: ['web-research', 'ai-discovered']
      });

      this.investigation.entities.push(sourceEntity);

      const addedEntities = [];
      const addedRelationships = [];

      // Add entities
      for (const entityData of data.entities || []) {
        // Check if entity already exists
        let existingEntity = this.investigation.entities.find(e =>
          e.name.toLowerCase() === entityData.name.toLowerCase()
        );

        if (existingEntity) {
          // Update existing entity with new source link
          if (!existingEntity.sourceLinks) existingEntity.sourceLinks = [];
          existingEntity.sourceLinks.push({
            sourceId: sourceEntity.id,
            description: entityData.sourceDescription || 'Mentioned in this source'
          });
          addedEntities.push({ name: existingEntity.name, status: 'updated' });
        } else {
          // Create new entity
          const newEntity = Schema.createEntity({
            name: entityData.name,
            type: entityData.type,
            aliases: entityData.aliases || [],
            attributes: entityData.attributes || {},
            flags: ['web-research', 'ai-discovered'],
            sourceLinks: [{
              sourceId: sourceEntity.id,
              description: entityData.sourceDescription || 'Discovered from web research'
            }]
          });

          this.investigation.entities.push(newEntity);
          addedEntities.push({ name: newEntity.name, status: 'created' });
        }
      }

      // Add relationships
      for (const relData of data.relationships || []) {
        const relSourceEntity = this.investigation.entities.find(e =>
          e.name.toLowerCase() === relData.source.toLowerCase()
        );
        const relTargetEntity = this.investigation.entities.find(e =>
          e.name.toLowerCase() === relData.target.toLowerCase()
        );

        if (!relSourceEntity || !relTargetEntity) {
          addedRelationships.push({
            source: relData.source,
            target: relData.target,
            status: 'skipped',
            reason: 'Entity not found'
          });
          continue;
        }

        // Check if relationship already exists
        const exists = this.investigation.relationships.find(r =>
          r.sourceId === relSourceEntity.id &&
          r.targetId === relTargetEntity.id &&
          r.type === relData.type
        );

        if (exists) {
          addedRelationships.push({
            source: relData.source,
            target: relData.target,
            type: relData.type,
            status: 'already_exists'
          });
          continue;
        }

        // Create new relationship
        const newRel = Schema.createRelationship({
          sourceId: relSourceEntity.id,
          targetId: relTargetEntity.id,
          type: relData.type,
          label: relData.explanation || relData.type,
          confidence: relData.confidence || 0.7,
          sourcesSupporting: [{
            sourceId: sourceEntity.id,
            explanation: relData.explanation || 'Found in web research'
          }]
        });

        newRel.attributes = {
          aiCreated: true,
          webResearch: true,
          explanation: relData.explanation
        };

        this.investigation.relationships.push(newRel);
        addedRelationships.push({
          source: relData.source,
          target: relData.target,
          type: relData.type,
          status: 'created'
        });
      }

      // Save investigation
      await Store.saveInvestigation(this.investigation);

      // Update graph visualization
      this.prepareGraphData();
      this.layoutGraph();
      this.render();
      this.updateStats();

      return {
        success: true,
        source: data.source_name,
        added: {
          entities: addedEntities,
          relationships: addedRelationships
        },
        summary: `Added ${addedEntities.filter(e => e.status === 'created').length} new entities, updated ${addedEntities.filter(e => e.status === 'updated').length} existing entities, and created ${addedRelationships.filter(r => r.status === 'created').length} new relationships.`
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to add to graph: ${err.message}`
      };
    }
  }

  async queryGraphWithLLM(question, graphContext, settings) {
    const endpoint = settings.endpoint || 'https://api.openai.com';
    const model = settings.model || 'gpt-4o';
    const apiKey = settings.apiKey;

    // Use reasoning model if specified (o1/o3)
    const useReasoningModel = model.includes('o1') || model.includes('o3');

    // Reasoning models don't support tools/functions, so use legacy approach
    if (useReasoningModel) {
      return await this.queryGraphWithLLMLegacy(question, graphContext, settings);
    }

    // Define tools for function calling
    const tools = [
      {
        type: "function",
        function: {
          name: "find_shortest_path",
          description: "Find the shortest path between two entities in the graph. Use this when you need to understand how two entities are connected, especially if they seem far apart. Supports fuzzy matching - handles spelling variations, punctuation differences, and minor typos.",
          parameters: {
            type: "object",
            properties: {
              source: {
                type: "string",
                description: "The name of the source entity (fuzzy matching enabled - don't worry about exact spelling)"
              },
              target: {
                type: "string",
                description: "The name of the target entity (fuzzy matching enabled - don't worry about exact spelling)"
              }
            },
            required: ["source", "target"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_entity_details",
          description: "Get detailed information about a specific entity, including all its relationships, attributes, and sources. Supports fuzzy matching for entity names.",
          parameters: {
            type: "object",
            properties: {
              entity_name: {
                type: "string",
                description: "The name of the entity to get details for (fuzzy matching enabled)"
              }
            },
            required: ["entity_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_related_entities",
          description: "Find all entities within N hops of a given entity. Useful for exploring neighborhoods in the graph. Supports fuzzy matching.",
          parameters: {
            type: "object",
            properties: {
              entity_name: {
                type: "string",
                description: "The name of the entity to start from (fuzzy matching enabled)"
              },
              max_depth: {
                type: "integer",
                description: "Maximum number of hops (1-3). Default is 2.",
                default: 2
              }
            },
            required: ["entity_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_web",
          description: "Search the web using Google to find information that's not in the current graph. Use this when you need to discover new information about entities or relationships. Returns search results with titles, snippets, and URLs.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query. Be specific and include entity names."
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "scrape_and_extract",
          description: "Scrape a webpage and automatically extract entities and relationships from it. Use this after searching to gather detailed information from promising URLs. The extracted entities will be returned but NOT automatically added to the graph - you must use add_to_graph to add them.",
          parameters: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "The URL to scrape"
              }
            },
            required: ["url"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_to_graph",
          description: "Add discovered entities and relationships to the graph. Use this after extracting information from web sources to persist your findings. Always create a Source entity for the webpage and link entities to it.",
          parameters: {
            type: "object",
            properties: {
              source_name: {
                type: "string",
                description: "Name/title of the source (e.g., page title or URL)"
              },
              source_url: {
                type: "string",
                description: "URL of the source"
              },
              entities: {
                type: "array",
                description: "Array of entities to add",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string" },
                    aliases: { type: "array", items: { type: "string" } },
                    attributes: { type: "object" },
                    sourceDescription: { type: "string" }
                  },
                  required: ["name", "type", "sourceDescription"]
                }
              },
              relationships: {
                type: "array",
                description: "Array of relationships to add",
                items: {
                  type: "object",
                  properties: {
                    source: { type: "string" },
                    target: { type: "string" },
                    type: { type: "string" },
                    explanation: { type: "string" },
                    confidence: { type: "number" }
                  },
                  required: ["source", "target", "type", "explanation"]
                }
              }
            },
            required: ["source_name", "source_url", "entities", "relationships"]
          }
        }
      }
    ];

    const systemPrompt = `You are an advanced AI assistant managing an investigation knowledge graph. You are an AUTONOMOUS RESEARCH AGENT that can search the web, scrape webpages, and expand the knowledge graph.

AVAILABLE TOOLS:

GRAPH QUERY TOOLS (with fuzzy matching):
- find_shortest_path: Find connections between distant entities
- get_entity_details: Get full information about an entity
- get_related_entities: Explore entity neighborhoods

WEB RESEARCH TOOLS:
- search_web: Search Google for information not in the graph
- scrape_and_extract: Scrape a webpage and extract entities/relationships
- add_to_graph: Add discovered information to the graph

CRITICAL WORKFLOW - When you lack information to answer a question:

1. CHECK THE GRAPH FIRST
   - Use find_shortest_path, get_entity_details, etc.
   - If you find the answer, provide it immediately

2. IF INFORMATION IS MISSING, SEARCH THE WEB
   - Use search_web with specific queries
   - Example: "Julie Payette company employment"
   - Review search results (titles and snippets)

3. SCRAPE PROMISING RESULTS
   - Use scrape_and_extract on relevant URLs
   - This extracts entities and relationships automatically
   - Review the extraction results

4. ADD FINDINGS TO GRAPH
   - Use add_to_graph to persist discoveries
   - ALWAYS create proper source provenance
   - Link all entities back to their source URLs

5. ANSWER THE QUESTION
   - Now that you've expanded the graph, answer the original question
   - Cite your sources (e.g., "According to [URL]...")

IMPORTANT NOTES:
- You can search multiple times and scrape multiple pages
- Be strategic - search for specific entities or relationships
- Always add findings to the graph so they're available for future questions
- All graph tools support fuzzy matching (spelling variations, typos)

GRAPH OVERVIEW:
- ${graphContext.entities.length} entities
- ${graphContext.relationships.length} relationships
- ${graphContext.sources.length} sources

CRITICAL INSTRUCTIONS FOR ANSWERING RELATIONSHIP QUESTIONS:

When a user asks about relationships between entities:

STEP 1: CHECK THE GRAPH
- Use find_shortest_path to check if a connection exists
- If found, explain it step-by-step with confidence scores

STEP 2: IF NO PATH EXISTS, SEARCH THE WEB
- Use search_web to find information about the entities
- Example: search_web("Julie Payette Plug and Play connection")
- Or search for each entity individually

STEP 3: SCRAPE AND EXTRACT
- Use scrape_and_extract on promising URLs
- Review the extracted entities and relationships

STEP 4: ADD TO GRAPH
- Use add_to_graph to persist your findings
- Now the graph contains the new information

STEP 5: ANSWER WITH CITATIONS
- Check the graph again with find_shortest_path
- Provide a detailed answer citing your sources

FORMAT EXAMPLE:
"Julie Payette is connected to Plug and Play through a chain of 3 relationships:

1. Julie Payette was **awarded by** Pierre Maisonneuve (confidence: 0.95)
2. Pierre Maisonneuve is the **uncle of** Philippe Maisonneuve (confidence: 1.0)
3. Philippe Maisonneuve is a **participant of** Plug and Play (confidence: 0.90)

Source: Information discovered from [URL] and added to the graph."

YOUR CAPABILITIES:
You can perform the following actions on the graph:

1. ADD_ENTITY - Create new entities
2. DELETE_ENTITY - Remove entities (use sparingly, only if clearly wrong)
3. ADD_RELATIONSHIP - Create new relationships with explanations
4. DELETE_RELATIONSHIP - Remove incorrect relationships
5. UPDATE_RELATIONSHIP - Modify confidence scores or add explanations

REASONING GUIDELINES:
- Use tools to explore the graph before answering complex questions
- For questions about relationships between entities, ALWAYS use find_shortest_path first
- Present path information clearly with numbered steps
- Infer logical relationships using transitive properties
- Add explanations to clarify why relationships exist
- Adjust confidence scores based on evidence strength
- Only delete entities/relationships if clearly incorrect or duplicate

When you're ready to provide a final answer, return a JSON object with this structure:
{
  "answer": "Your detailed response following the formatting guidelines above",
  "reasoning": "Explain your thought process and what tools you used",
  "actions": [
    {
      "type": "add_entity|delete_entity|add_relationship|delete_relationship|update_relationship",
      "entity": { "name": "string", "type": "person|organization|...", "aliases": [], "attributes": {} },
      "relationship": { "source": "entity name", "target": "entity name", "type": "relationship_type", "explanation": "REQUIRED", "confidence": 0.0-1.0 },
      "entityName": "name of entity to delete",
      "relationshipId": "ID of relationship to delete/update",
      "updates": { "confidence": 0.0-1.0, "explanation": "string" },
      "reason": "Why this action is being taken"
    }
  ]
}`;

    // Conversation messages
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: question }
    ];

    let maxIterations = 10; // Increased to allow for web research
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      const requestBody = {
        model: model,
        messages: messages,
        tools: tools,
        tool_choice: "auto",
        temperature: 0.2
      };

      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const message = data.choices[0].message;

      // Add assistant message to conversation
      messages.push(message);

      // If no tool calls, we're done
      if (!message.tool_calls || message.tool_calls.length === 0) {
        // Parse the final response
        const content = message.content;

        let result;
        try {
          result = JSON.parse(content);
        } catch (e) {
          // Fallback parsing
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
          } else {
            // If not JSON, wrap it
            result = {
              answer: content,
              reasoning: "Direct answer provided",
              actions: []
            };
          }
        }

        return result;
      }

      // Execute tool calls
      for (const toolCall of message.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        // Show status for web research operations
        let statusMsgId = null;
        if (functionName === 'search_web') {
          statusMsgId = this.addChatMessage('system', `🔍 Searching web: "${args.query}"`);
        } else if (functionName === 'scrape_and_extract') {
          statusMsgId = this.addChatMessage('system', `📄 Scraping webpage: ${args.url}`);
        } else if (functionName === 'add_to_graph') {
          statusMsgId = this.addChatMessage('system', `➕ Adding discoveries to graph...`);
        }

        let toolResult;

        switch (functionName) {
          case 'find_shortest_path':
            toolResult = this.findShortestPath(args.source, args.target);
            break;
          case 'get_entity_details':
            toolResult = this.getEntityDetails(args.entity_name);
            break;
          case 'get_related_entities':
            toolResult = this.getRelatedEntities(args.entity_name, args.max_depth || 2);
            break;
          case 'search_web':
            toolResult = await this.searchGoogle(args.query, settings.googleApiKey, settings.googleCx);
            if (statusMsgId) this.removeChatMessage(statusMsgId);
            if (toolResult.results && toolResult.results.length > 0) {
              this.addChatMessage('system', `✓ Found ${toolResult.results.length} search results`);
            }
            break;
          case 'scrape_and_extract':
            // First scrape the webpage
            const scrapeResult = await this.scrapeWebpage(args.url, settings.firecrawlApiKey);
            if (scrapeResult.error) {
              toolResult = scrapeResult;
              if (statusMsgId) this.removeChatMessage(statusMsgId);
            } else {
              // Then extract entities from the content
              const extractResult = await this.extractEntitiesFromText(
                scrapeResult.content,
                scrapeResult.url,
                settings
              );
              toolResult = {
                url: scrapeResult.url,
                title: scrapeResult.title,
                extraction: extractResult
              };
              if (statusMsgId) this.removeChatMessage(statusMsgId);
              if (extractResult.entities && extractResult.relationships) {
                this.addChatMessage('system', `✓ Extracted ${extractResult.entities.length} entities and ${extractResult.relationships.length} relationships`);
              }
            }
            break;
          case 'add_to_graph':
            toolResult = await this.addToGraphFromWeb(args);
            if (statusMsgId) this.removeChatMessage(statusMsgId);
            if (toolResult.success) {
              this.addChatMessage('system', `✓ ${toolResult.summary}`);
            }
            break;
          default:
            toolResult = { error: 'Unknown function' };
        }

        // Add tool result to messages
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      }
    }

    // If we hit max iterations, return what we have
    throw new Error('Max tool iterations reached. Please simplify your question.');
  }

  async queryGraphWithLLMLegacy(question, graphContext, settings) {
    // Legacy approach for reasoning models (o1/o3) that don't support function calling
    const endpoint = settings.endpoint || 'https://api.openai.com';
    const model = settings.model || 'gpt-4o';
    const apiKey = settings.apiKey;

    const prompt = `You are an advanced AI assistant managing an investigation knowledge graph. You can answer questions, maintain graph quality, and perform sophisticated reasoning.

INVESTIGATION GRAPH:

Entities (${graphContext.entities.length}):
${graphContext.entities.map(e => `- [${e.id}] ${e.name} (${e.type})${e.aliases.length ? ` aka ${e.aliases.join(', ')}` : ''}${Object.keys(e.attributes).length ? ` [${Object.entries(e.attributes).map(([k,v]) => `${k}: ${v}`).join(', ')}]` : ''}`).join('\n')}

Relationships (${graphContext.relationships.length}):
${graphContext.relationships.map(r => `- [${r.id}] ${r.source} → ${r.type} → ${r.target} (confidence: ${r.confidence})${r.sourcesSupporting?.length ? ` [${r.sourcesSupporting.length} sources]` : ''}`).join('\n')}

Sources (${graphContext.sources.length}):
${graphContext.sources.map(s => `- [${s.id}] ${s.name}${s.url ? ` (${s.url})` : ''}`).join('\n')}

USER REQUEST: ${question}

YOUR CAPABILITIES:
You can perform the following actions on the graph:

1. ADD_ENTITY - Create new entities
2. DELETE_ENTITY - Remove entities (use sparingly, only if clearly wrong)
3. ADD_RELATIONSHIP - Create new relationships with explanations
4. DELETE_RELATIONSHIP - Remove incorrect relationships
5. UPDATE_RELATIONSHIP - Modify confidence scores or add explanations

REASONING GUIDELINES:
- Analyze the graph for errors, contradictions, and missing information
- Infer logical relationships using transitive properties
- Add explanations to clarify why relationships exist
- Adjust confidence scores based on evidence strength
- Only delete entities/relationships if clearly incorrect or duplicate

Return a JSON object with this EXACT structure:
{
  "answer": "Your detailed response to the user's request",
  "reasoning": "Explain your thought process and why you're taking these actions",
  "actions": [
    {
      "type": "add_entity|delete_entity|add_relationship|delete_relationship|update_relationship",
      "entity": { "name": "string", "type": "person|organization|...", "aliases": [], "attributes": {} },
      "relationship": { "source": "entity name", "target": "entity name", "type": "relationship_type", "explanation": "REQUIRED", "confidence": 0.0-1.0 },
      "entityName": "name of entity to delete",
      "relationshipId": "ID of relationship to delete/update",
      "updates": { "confidence": 0.0-1.0, "explanation": "string" },
      "reason": "Why this action is being taken"
    }
  ]
}

CRITICAL RULES:
- EVERY relationship (new or inferred) MUST have an "explanation" field
- Be conservative with deletions - only remove if clearly wrong
- Set appropriate confidence scores (0.0-1.0)
- Always explain your reasoning
- Return ONLY valid JSON`;

    const requestBody = {
      model: model,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 1
    };

    const response = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      // Fallback parsing
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse LLM response');
      }
    }

    return result;
  }

  async executeActions(actions) {
    let changed = false;

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'add_entity':
            if (action.entity) {
              const newEntity = Schema.createEntity({
                name: action.entity.name,
                type: action.entity.type,
                aliases: action.entity.aliases || [],
                attributes: action.entity.attributes || {},
                flags: ['ai-created'],
                relevanceScore: 0.7
              });
              this.investigation.entities.push(newEntity);
              changed = true;
            }
            break;

          case 'delete_entity':
            if (action.entityName) {
              const idx = this.investigation.entities.findIndex(e =>
                e.name.toLowerCase() === action.entityName.toLowerCase()
              );
              if (idx !== -1) {
                const entityId = this.investigation.entities[idx].id;
                // Remove entity
                this.investigation.entities.splice(idx, 1);
                // Remove related relationships
                this.investigation.relationships = this.investigation.relationships.filter(r =>
                  r.sourceId !== entityId && r.targetId !== entityId
                );
                changed = true;
              }
            }
            break;

          case 'add_relationship':
            if (action.relationship) {
              const sourceEntity = this.investigation.entities.find(e =>
                e.name.toLowerCase() === action.relationship.source.toLowerCase()
              );
              const targetEntity = this.investigation.entities.find(e =>
                e.name.toLowerCase() === action.relationship.target.toLowerCase()
              );

              if (sourceEntity && targetEntity) {
                const exists = this.investigation.relationships.find(r =>
                  r.sourceId === sourceEntity.id &&
                  r.targetId === targetEntity.id &&
                  r.type === action.relationship.type
                );

                if (!exists) {
                  const newRel = Schema.createRelationship({
                    sourceId: sourceEntity.id,
                    targetId: targetEntity.id,
                    type: action.relationship.type,
                    label: action.relationship.explanation || action.relationship.type,
                    confidence: action.relationship.confidence || 0.8,
                    captureId: null
                  });
                  newRel.attributes = {
                    aiCreated: true,
                    explanation: action.relationship.explanation
                  };
                  this.investigation.relationships.push(newRel);
                  changed = true;
                }
              }
            }
            break;

          case 'delete_relationship':
            if (action.relationshipId) {
              const idx = this.investigation.relationships.findIndex(r =>
                r.id === action.relationshipId
              );
              if (idx !== -1) {
                this.investigation.relationships.splice(idx, 1);
                changed = true;
              }
            }
            break;

          case 'update_relationship':
            if (action.relationshipId && action.updates) {
              const rel = this.investigation.relationships.find(r =>
                r.id === action.relationshipId
              );
              if (rel) {
                if (action.updates.confidence !== undefined) {
                  rel.confidence = action.updates.confidence;
                }
                if (action.updates.explanation) {
                  if (!rel.attributes) rel.attributes = {};
                  rel.attributes.explanation = action.updates.explanation;
                }
                changed = true;
              }
            }
            break;
        }
      } catch (err) {
        console.error(`Failed to execute action ${action.type}:`, err);
      }
    }

    if (changed) {
      await Store.saveInvestigation(this.investigation);
      this.prepareGraphData();
      this.layoutGraph();
      this.render();
    }
  }

  renderMessage(message) {
    const container = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${message.type}`;
    messageDiv.id = message.id;

    let content = message.content;

    // Add reasoning if provided
    if (message.type === 'assistant' && message.reasoning) {
      content += `<div class="ai-reasoning"><strong>💭 Reasoning:</strong> ${message.reasoning}</div>`;
    }

    // Add actions if provided
    if (message.type === 'assistant' && message.actions && message.actions.length > 0) {
      const actions = message.actions;
      const actionsByType = {
        add_entity: [],
        delete_entity: [],
        add_relationship: [],
        delete_relationship: [],
        update_relationship: []
      };

      actions.forEach(a => {
        if (actionsByType[a.type]) {
          actionsByType[a.type].push(a);
        }
      });

      let actionsHtml = '<div class="ai-actions"><h4>🔧 Actions Taken:</h4>';

      if (actionsByType.add_entity.length > 0) {
        actionsHtml += '<div class="action-group"><strong>➕ Added Entities:</strong><ul>';
        actionsByType.add_entity.forEach(a => {
          actionsHtml += `<li>${a.entity.name} (${a.entity.type})${a.reason ? ` - ${a.reason}` : ''}</li>`;
        });
        actionsHtml += '</ul></div>';
      }

      if (actionsByType.add_relationship.length > 0) {
        actionsHtml += '<div class="action-group"><strong>🔗 Added Relationships:</strong><ul>';
        actionsByType.add_relationship.forEach(a => {
          actionsHtml += `<li>${a.relationship.source} → ${a.relationship.type} → ${a.relationship.target}<br><small>${a.relationship.explanation}</small></li>`;
        });
        actionsHtml += '</ul></div>';
      }

      if (actionsByType.update_relationship.length > 0) {
        actionsHtml += '<div class="action-group"><strong>✏️ Updated Relationships:</strong><ul>';
        actionsByType.update_relationship.forEach(a => {
          actionsHtml += `<li>${a.reason || 'Updated confidence/explanation'}</li>`;
        });
        actionsHtml += '</ul></div>';
      }

      if (actionsByType.delete_relationship.length > 0) {
        actionsHtml += '<div class="action-group"><strong>❌ Removed Relationships:</strong><ul>';
        actionsByType.delete_relationship.forEach(a => {
          actionsHtml += `<li>${a.reason || 'Removed relationship'}</li>`;
        });
        actionsHtml += '</ul></div>';
      }

      if (actionsByType.delete_entity.length > 0) {
        actionsHtml += '<div class="action-group"><strong>🗑️ Removed Entities:</strong><ul>';
        actionsByType.delete_entity.forEach(a => {
          actionsHtml += `<li>${a.entityName}${a.reason ? ` - ${a.reason}` : ''}</li>`;
        });
        actionsHtml += '</ul></div>';
      }

      actionsHtml += '</div>';
      content += actionsHtml;
    }

    messageDiv.innerHTML = content;

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
  }

  addChatMessage(type, text) {
    // Simple temporary message (for loading, etc)
    const container = document.getElementById('chat-messages');
    const messageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    messageDiv.id = messageId;
    messageDiv.textContent = text;

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;

    return messageId;
  }

  removeChatMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
      message.remove();
    }
  }

  openEntityModal() {
    document.getElementById('entity-name').value = '';
    document.getElementById('entity-type').value = 'person';
    document.getElementById('entity-aliases').value = '';
    document.getElementById('entity-notes').value = '';
    document.getElementById('entity-modal').classList.remove('hidden');
  }

  closeEntityModal() {
    document.getElementById('entity-modal').classList.add('hidden');
  }

  async saveEntity() {
    const name = document.getElementById('entity-name').value.trim();
    if (!name) {
      alert('Please enter an entity name');
      return;
    }

    const type = document.getElementById('entity-type').value;
    const aliasesStr = document.getElementById('entity-aliases').value.trim();
    const aliases = aliasesStr ? aliasesStr.split(',').map(a => a.trim()).filter(a => a) : [];
    const notes = document.getElementById('entity-notes').value.trim();

    // Handle source-specific attributes
    const attributes = {};
    if (type === 'source') {
      const url = document.getElementById('source-url').value.trim();
      const collected = document.getElementById('source-collected').value;
      const published = document.getElementById('source-published').value;

      if (!collected) {
        alert('Please enter date collected for source');
        return;
      }

      attributes.url = url;
      attributes.dateCollected = collected;
      if (published) attributes.publicationDate = published;
    }

    // Create new entity using schema
    const newEntity = Schema.createEntity({
      name: name,
      type: type,
      aliases: aliases,
      attributes: attributes,
      notes: notes,
      relevanceScore: 0.5, // Default for manually created
      flags: ['manual'],
      captureId: null // Manually created
    });

    // Add to investigation
    this.investigation.entities.push(newEntity);

    // Save to storage
    await Store.saveInvestigation(this.investigation);

    // Update graph
    this.prepareGraphData();
    this.layoutGraph();
    this.fitView();

    // Close modal
    this.closeEntityModal();

    // Show success
    alert(`Entity "${name}" created successfully!`);
  }

  toggleAddRelationshipMode() {
    this.addRelationshipMode = !this.addRelationshipMode;
    this.relationshipSourceNode = null;
    this.selectedNode = null;

    const btn = document.getElementById('btn-add-relationship');
    if (this.addRelationshipMode) {
      btn.classList.add('active');
      btn.textContent = '✕ Cancel Add Relationship';
    } else {
      btn.classList.remove('active');
      btn.textContent = '🔗 Add Relationship';
    }

    this.render();
  }

  openRelationshipModal(sourceNode, targetNode) {
    document.getElementById('rel-source-name').textContent = sourceNode.label;
    document.getElementById('rel-target-name').textContent = targetNode.label;
    document.getElementById('rel-type').value = '';
    document.getElementById('rel-label').value = '';
    document.getElementById('rel-confidence').value = '0.7';
    document.getElementById('confidence-value').textContent = '0.7';

    // Store nodes for later
    this.pendingRelationship = {
      source: sourceNode,
      target: targetNode,
      attachedSources: [] // Track sources attached to this relationship
    };

    // Clear sources list
    document.getElementById('rel-sources-list').innerHTML = '';

    document.getElementById('relationship-modal').classList.remove('hidden');
  }

  closeRelationshipModal() {
    document.getElementById('relationship-modal').classList.add('hidden');
    this.pendingRelationship = null;
    this.relationshipSourceNode = null;
    this.selectedNode = null;
    this.render();
  }

  addSourceToRelationship() {
    // Get all source entities
    const sources = this.investigation.entities.filter(e => e.type === 'source');

    if (sources.length === 0) {
      alert('No sources available. Create a Source entity first.');
      return;
    }

    // Create a simple select prompt
    const sourceNames = sources.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
    const selection = prompt(`Select a source by number:\n\n${sourceNames}`);

    if (!selection) return;

    const index = parseInt(selection) - 1;
    if (index < 0 || index >= sources.length) {
      alert('Invalid selection');
      return;
    }

    const selectedSource = sources[index];

    // Ask for explanation
    const explanation = prompt(`How does "${selectedSource.name}" support this relationship?`);
    if (!explanation) return;

    // Add to pending relationship
    this.pendingRelationship.attachedSources.push({
      sourceId: selectedSource.id,
      sourceName: selectedSource.name,
      explanation: explanation.trim()
    });

    // Update UI
    this.renderRelationshipSources();
  }

  renderRelationshipSources() {
    const container = document.getElementById('rel-sources-list');
    const sources = this.pendingRelationship.attachedSources;

    container.innerHTML = sources.map((s, index) => `
      <div class="source-item">
        <div class="source-item-header">
          <span class="source-item-name">📄 ${s.sourceName}</span>
          <button class="btn-remove-source" data-index="${index}">×</button>
        </div>
        <textarea class="source-explanation" data-index="${index}" placeholder="Explanation...">${s.explanation}</textarea>
      </div>
    `).join('');

    // Add remove handlers
    container.querySelectorAll('.btn-remove-source').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.pendingRelationship.attachedSources.splice(idx, 1);
        this.renderRelationshipSources();
      });
    });

    // Add explanation update handlers
    container.querySelectorAll('.source-explanation').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.pendingRelationship.attachedSources[idx].explanation = e.target.value;
      });
    });
  }

  async saveRelationship() {
    if (!this.pendingRelationship) return;

    const type = document.getElementById('rel-type').value.trim();
    if (!type) {
      alert('Please enter a relationship type');
      return;
    }

    const label = document.getElementById('rel-label').value.trim() || type;
    const confidence = parseFloat(document.getElementById('rel-confidence').value);

    // Prepare source attachments (remove sourceName as it's just for UI)
    const sourcesSupporting = this.pendingRelationship.attachedSources.map(s => ({
      sourceId: s.sourceId,
      explanation: s.explanation
    }));

    // Create new relationship using schema
    const newRelationship = Schema.createRelationship({
      sourceId: this.pendingRelationship.source.id,
      targetId: this.pendingRelationship.target.id,
      type: type,
      label: label,
      confidence: confidence,
      captureId: null, // Manually created, not from a capture
      sourcesSupporting: sourcesSupporting
    });

    // Add to investigation
    this.investigation.relationships.push(newRelationship);

    // Save to storage
    await Store.saveInvestigation(this.investigation);

    // Update graph
    this.prepareGraphData();
    this.render();

    // Close modal and exit add mode
    this.closeRelationshipModal();
    this.toggleAddRelationshipMode();

    // Show success
    alert('Relationship created successfully!');
  }

  showEntityDetails(entity) {
    const panel = document.getElementById('entity-panel');

    document.getElementById('panel-entity-name').textContent = entity.name;
    document.getElementById('panel-entity-type').textContent = entity.type;

    let detailsHTML = '';

    if (Object.keys(entity.attributes).length > 0) {
      detailsHTML += '<div class="detail-section"><h4>Attributes</h4>';
      for (const [key, value] of Object.entries(entity.attributes)) {
        detailsHTML += `<div class="detail-item"><strong>${key}:</strong> ${value}</div>`;
      }
      detailsHTML += '</div>';
    }

    if (entity.aliases.length > 0) {
      detailsHTML += '<div class="detail-section"><h4>Aliases</h4>';
      detailsHTML += `<div class="detail-item">${entity.aliases.join(', ')}</div>`;
      detailsHTML += '</div>';
    }

    if (entity.flags.length > 0) {
      detailsHTML += '<div class="detail-section"><h4>Flags</h4>';
      detailsHTML += `<div class="detail-item">${entity.flags.join(', ')}</div>`;
      detailsHTML += '</div>';
    }

    detailsHTML += '<div class="detail-section"><h4>Statistics</h4>';
    detailsHTML += `<div class="detail-item"><strong>Occurrences:</strong> ${entity.occurrences.length}</div>`;
    detailsHTML += `<div class="detail-item"><strong>Relevance Score:</strong> ${(entity.relevanceScore * 100).toFixed(0)}%</div>`;
    detailsHTML += '</div>';

    // Source links
    if (entity.sourceLinks && entity.sourceLinks.length > 0) {
      detailsHTML += '<div class="detail-section"><h4>Referenced in Sources</h4>';
      entity.sourceLinks.forEach(link => {
        const source = this.investigation.entities.find(e => e.id === link.sourceId);
        if (source) {
          detailsHTML += `
            <div class="detail-item">
              <strong>📄 ${source.name}</strong><br>
              <small>${link.description}</small>
            </div>
          `;
        }
      });
      detailsHTML += '</div>';
    }

    document.getElementById('panel-entity-details').innerHTML = detailsHTML;

    const connections = this.investigation.relationships.filter(
      r => r.sourceId === entity.id || r.targetId === entity.id
    );

    let connectionsHTML = '<div class="detail-section"><h4>Connections</h4>';

    if (connections.length === 0) {
      connectionsHTML += '<div class="detail-item">No connections found</div>';
    } else {
      connections.forEach(rel => {
        const isSource = rel.sourceId === entity.id;
        const otherId = isSource ? rel.targetId : rel.sourceId;
        const otherEntity = this.investigation.entities.find(e => e.id === otherId);

        if (otherEntity) {
          let sourcesHtml = '';
          if (rel.sourcesSupporting && rel.sourcesSupporting.length > 0) {
            sourcesHtml = '<div style="margin-top: 6px; padding-left: 8px; border-left: 2px solid var(--border);">';
            rel.sourcesSupporting.forEach(ss => {
              const source = this.investigation.entities.find(e => e.id === ss.sourceId);
              if (source) {
                sourcesHtml += `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">📄 ${source.name}: ${ss.explanation}</div>`;
              }
            });
            sourcesHtml += '</div>';
          }

          connectionsHTML += `
            <div class="connection-item">
              ${isSource ? entity.name : otherEntity.name}
              <span class="connection-type">${rel.type}</span>
              ${isSource ? otherEntity.name : entity.name}
              ${sourcesHtml}
            </div>
          `;
        }
      });
    }

    connectionsHTML += '</div>';
    document.getElementById('panel-entity-connections').innerHTML = connectionsHTML;

    panel.classList.remove('hidden');
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  new InvestigationDashboard();
});
