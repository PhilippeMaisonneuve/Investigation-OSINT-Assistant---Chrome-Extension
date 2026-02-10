class InvestigationApp {
  constructor() {
    this.currentView = 'dashboard';
    this.activeInvestigation = null;
    this.pendingCapture = null;
    this.pendingExtraction = null;
    this.hypotheses = [];
    this.signals = [];

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadDashboard();
    this.checkActiveInvestigation();
  }

  // ===== Navigation =====

  showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    this.currentView = viewName;
  }

  // ===== Event Binding =====

  bindEvents() {
    // Settings
    document.getElementById('btn-settings').addEventListener('click', () => {
      this.showView('settings');
      this.loadSettings();
    });

    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    document.getElementById('setting-provider').addEventListener('change', (e) => {
      const endpoint = document.getElementById('setting-endpoint');
      if (e.target.value === 'openai') {
        endpoint.value = 'https://api.openai.com';
        document.getElementById('setting-model').value = 'gpt-4o';
      } else {
        endpoint.value = 'http://localhost:11434';
        document.getElementById('setting-model').value = 'gemma3:4b';
      }
    });

    // Navigation - back buttons
    document.querySelectorAll('.btn-back').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.view;
        if (target === 'dashboard') {
          this.showView('dashboard');
          this.loadDashboard();
        }
      });
    });

    // New Investigation
    document.getElementById('btn-new-investigation').addEventListener('click', () => {
      this.hypotheses = [];
      this.signals = [];
      this.showView('new-investigation');
      this.renderTagList('hypotheses-list', this.hypotheses);
      this.renderTagList('signals-list', this.signals);
    });

    // Hypothesis & Signal inputs
    document.getElementById('btn-add-hypothesis').addEventListener('click', () => {
      this.addTagFromInput('inv-hypothesis-input', this.hypotheses, 'hypotheses-list');
    });

    document.getElementById('inv-hypothesis-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addTagFromInput('inv-hypothesis-input', this.hypotheses, 'hypotheses-list');
      }
    });

    document.getElementById('btn-add-signal').addEventListener('click', () => {
      this.addTagFromInput('inv-signal-input', this.signals, 'signals-list');
    });

    document.getElementById('inv-signal-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addTagFromInput('inv-signal-input', this.signals, 'signals-list');
      }
    });

    // Investigation form submit
    document.getElementById('investigation-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createInvestigation();
    });

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      });
    });

    // Open graph visualization
    document.getElementById('btn-open-graph').addEventListener('click', () => this.openGraphView());

    // Capture button
    document.getElementById('btn-capture-full').addEventListener('click', () => this.captureFullPage());

    // Extraction actions
    document.getElementById('btn-save-extraction').addEventListener('click', () => this.saveExtraction());
    document.getElementById('btn-discard-extraction').addEventListener('click', () => this.discardExtraction());
  }

  // ===== Settings =====

  async loadSettings() {
    const settings = await Store.getSettings();
    document.getElementById('setting-provider').value = settings.llmProvider;
    document.getElementById('setting-endpoint').value = settings.endpoint;
    document.getElementById('setting-apikey').value = settings.apiKey;
    document.getElementById('setting-model').value = settings.model;
    document.getElementById('setting-google-api-key').value = settings.googleApiKey || '';
    document.getElementById('setting-google-cx').value = settings.googleCx || '';
    document.getElementById('setting-firecrawl-api-key').value = settings.firecrawlApiKey || '';
  }

  async saveSettings() {
    const settings = {
      llmProvider: document.getElementById('setting-provider').value,
      endpoint: document.getElementById('setting-endpoint').value,
      apiKey: document.getElementById('setting-apikey').value,
      model: document.getElementById('setting-model').value,
      googleApiKey: document.getElementById('setting-google-api-key').value,
      googleCx: document.getElementById('setting-google-cx').value,
      firecrawlApiKey: document.getElementById('setting-firecrawl-api-key').value
    };
    await Store.saveSettings(settings);
    this.showView('dashboard');
    this.loadDashboard();
  }

  // ===== Tag Inputs (Hypotheses & Signals) =====

  addTagFromInput(inputId, array, listId) {
    const input = document.getElementById(inputId);
    const value = input.value.trim();
    if (value && !array.includes(value)) {
      array.push(value);
      this.renderTagList(listId, array);
      input.value = '';
    }
  }

  renderTagList(containerId, array) {
    const container = document.getElementById(containerId);
    container.innerHTML = array.map((item, i) => `
      <span class="tag-item">
        ${item}
        <button class="tag-remove" data-index="${i}">×</button>
      </span>
    `).join('');

    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        array.splice(parseInt(btn.dataset.index), 1);
        this.renderTagList(containerId, array);
      });
    });
  }

  // ===== Dashboard =====

  async loadDashboard() {
    const investigations = await Store.getInvestigationList();
    const container = document.getElementById('investigation-list');

    if (investigations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No investigations yet.</p>
          <p>Start one to begin capturing and analyzing.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = investigations.map(inv => `
      <div class="investigation-card" data-id="${inv.id}">
        <h3>${inv.title}</h3>
        <div class="meta">
          <span>🔗 ${inv.entityCount || 0} entities</span>
          <span>📸 ${inv.captureCount || 0} captures</span>
          <span>${this.timeAgo(inv.updatedAt)}</span>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.investigation-card').forEach(card => {
      card.addEventListener('click', () => this.openInvestigation(card.dataset.id));
    });
  }

  async checkActiveInvestigation() {
    const activeId = await Store.getActiveInvestigationId();
    if (activeId) {
      await this.openInvestigation(activeId);
    }
  }

  // ===== Investigation CRUD =====

  async createInvestigation() {
    const investigation = Schema.createInvestigation({
      title: document.getElementById('inv-title').value,
      objective: document.getElementById('inv-objective').value,
      hypotheses: [...this.hypotheses],
      signals: [...this.signals]
    });

    await Store.saveInvestigation(investigation);
    await Store.setActiveInvestigationId(investigation.id);
    this.activeInvestigation = investigation;

    // Clear form
    document.getElementById('investigation-form').reset();
    this.hypotheses = [];
    this.signals = [];

    this.showView('investigation');
    this.renderInvestigation();
  }

  async openInvestigation(id) {
    const investigation = await Store.getInvestigation(id);
    if (!investigation) return;

    this.activeInvestigation = investigation;
    await Store.setActiveInvestigationId(id);
    this.showView('investigation');
    this.renderInvestigation();
  }

  openGraphView() {
    if (!this.activeInvestigation) return;

    // Open dashboard in new tab
    const url = chrome.runtime.getURL(`dashboard/dashboard.html?id=${this.activeInvestigation.id}`);
    chrome.tabs.create({ url: url });
  }

  renderInvestigation() {
    const inv = this.activeInvestigation;
    document.getElementById('active-inv-title').textContent = inv.title;
    this.renderEntitiesTab();
    this.renderSuggestionsTab();
    this.renderCapturesTab();
    this.resetCaptureTab();
  }

  // ===== Capture =====

  async captureFullPage() {
    try {
      this.showStatus('loading', '📸 Capturing page...');

      const response = await chrome.runtime.sendMessage({
        action: 'captureFullPage'
      });

      if (response.error) {
        this.showStatus('error', `Capture failed: ${response.error}`);
        return;
      }

      this.pendingCapture = Schema.createCapture({
        imageData: response.imageData,
        sourceUrl: response.url,
        pageTitle: response.title,
        captureType: 'full',
        pageText: response.pageText,
        metadata: response.metadata
      });

      this.showCapturePreview();
      await this.runExtraction();

    } catch (err) {
      this.showStatus('error', `Capture failed: ${err.message}`);
    }
  }

  async captureRegion() {
    try {
      this.showStatus('loading', '✂️ Select a region on the page...');

      // Close popup temporarily - content script will handle selection
      const response = await chrome.runtime.sendMessage({
        action: 'startRegionCapture'
      });

      if (response.error) {
        this.showStatus('error', `Region capture failed: ${response.error}`);
        return;
      }

      // The content script will send the result back via message
      // We listen for it
      chrome.runtime.onMessage.addListener(async (msg) => {
        if (msg.action === 'regionCaptured') {
          this.pendingCapture = Schema.createCapture({
            imageData: msg.imageData,
            sourceUrl: msg.url,
            pageTitle: msg.title,
            captureType: 'region'
          });
          this.showCapturePreview();
          await this.runExtraction();
        }
      });

    } catch (err) {
      this.showStatus('error', `Region capture failed: ${err.message}`);
    }
  }

  showCapturePreview() {
    const preview = document.getElementById('capture-preview');
    const image = document.getElementById('capture-image');
    const meta = document.getElementById('capture-meta');

    image.src = this.pendingCapture.imageData;
    meta.textContent = `${this.pendingCapture.sourceUrl} · ${new Date(this.pendingCapture.timestamp).toLocaleString()}`;
    preview.classList.remove('hidden');
  }

  // ===== LLM Extraction =====

  async runExtraction() {
    this.showStatus('loading', '🧠 Analyzing capture with AI...');

    try {
      const settings = await Store.getSettings();

      if (!settings.apiKey && settings.llmProvider === 'openai') {
        this.showStatus('error', 'Please set your API key in Settings ⚙️');
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'extractFromCapture',
        imageData: this.pendingCapture.imageData,
        pageText: this.pendingCapture.pageText,
        metadata: this.pendingCapture.metadata,
        investigation: {
          objective: this.activeInvestigation.objective,
          hypotheses: this.activeInvestigation.hypotheses,
          signals: this.activeInvestigation.signals,
          existingEntities: this.activeInvestigation.entities.map(e => ({
            name: e.name,
            type: e.type,
            aliases: e.aliases
          })),
          existingRelationships: this.activeInvestigation.relationships.map(r => ({
            source: this.activeInvestigation.entities.find(e => e.id === r.sourceId)?.name,
            target: this.activeInvestigation.entities.find(e => e.id === r.targetId)?.name,
            type: r.type
          }))
        },
        settings: settings
      });

      if (response.error) {
        this.showStatus('error', `Extraction failed: ${response.error}`);
        return;
      }

      this.pendingExtraction = response.extraction;
      this.showStatus('success', `✅ Found ${response.extraction.entities?.length || 0} entities, ${response.extraction.relationships?.length || 0} relationships`);
      this.renderExtractionResults();

    } catch (err) {
      this.showStatus('error', `Extraction failed: ${err.message}`);
    }
  }

  renderExtractionResults() {
    const container = document.getElementById('extraction-results');
    const extraction = this.pendingExtraction;

    // Entities
    const entitiesContainer = document.getElementById('extracted-entities');
    entitiesContainer.innerHTML = (extraction.entities || []).map(e => `
      <div class="entity-item" data-type="${e.type}">
        <div>
          <span class="entity-type-badge">${e.type}</span>
          <span class="entity-name">${e.name}</span>
          ${e.attributes ? `<div class="entity-detail">${Object.entries(e.attributes).map(([k,v]) => `${k}: ${v}`).join(' · ')}</div>` : ''}
          ${e.existingMatch ? `<div class="entity-occurrences">🔗 Matches existing entity</div>` : ''}
        </div>
      </div>
    `).join('') || '<div class="empty-state">No entities found</div>';

    // Relationships
    const relsContainer = document.getElementById('extracted-relationships');
    relsContainer.innerHTML = (extraction.relationships || []).map(r => `
      <div class="relationship-item">
        <span class="rel-source">${r.source}</span>
        <span class="rel-arrow">→</span>
        <span class="rel-type">${r.type}</span>
        <span class="rel-arrow">→</span>
        <span class="rel-target">${r.target}</span>
      </div>
    `).join('') || '';

    // Suggestions
    const sugContainer = document.getElementById('extracted-suggestions');
    sugContainer.innerHTML = (extraction.explorationSuggestions || []).map(s => `
      <div class="suggestion-item ${s.priority}">
        <div class="suggestion-text">💡 ${s.suggestion}</div>
        <div class="suggestion-reason">${s.reason}</div>
        <span class="suggestion-priority ${s.priority}">${s.priority}</span>
      </div>
    `).join('') || '';

    container.classList.remove('hidden');
  }

  // ===== Save / Discard Extraction =====

  async saveExtraction() {
    if (!this.pendingExtraction || !this.pendingCapture) return;

    const inv = this.activeInvestigation;
    const extraction = this.pendingExtraction;

    // Save capture
    this.pendingCapture.rawExtraction = extraction;
    inv.captures.push(this.pendingCapture);

    // Create Source entity from extraction
    let sourceEntity = null;
    if (extraction.source) {
      sourceEntity = Schema.createEntity({
        name: extraction.source.name || this.pendingCapture.pageTitle || 'Untitled Source',
        type: 'source',
        attributes: {
          url: extraction.source.url || this.pendingCapture.sourceUrl,
          dateCollected: extraction.source.dateCollected || new Date().toISOString().split('T')[0],
          publicationDate: extraction.source.publicationDate || null
        },
        captureId: this.pendingCapture.id,
        relevanceScore: 1.0,
        flags: ['auto-generated']
      });
      inv.entities.push(sourceEntity);
    }

    // Merge entities (with deduplication)
    for (const extractedEntity of (extraction.entities || [])) {
      const existing = inv.entities.find(e =>
        e.name.toLowerCase() === extractedEntity.name.toLowerCase() ||
        e.aliases.some(a => a.toLowerCase() === extractedEntity.name.toLowerCase())
      );

      if (existing) {
        existing.occurrences.push(this.pendingCapture.id);
        if (extractedEntity.attributes) {
          existing.attributes = { ...existing.attributes, ...extractedEntity.attributes };
        }
        if (extractedEntity.aliases) {
          existing.aliases = [...new Set([...existing.aliases, ...extractedEntity.aliases])];
        }
        existing.relevanceScore = Math.max(existing.relevanceScore, extractedEntity.relevanceScore || 0);

        // Add source link if we have a source and description
        if (sourceEntity && extractedEntity.sourceDescription) {
          if (!existing.sourceLinks) existing.sourceLinks = [];
          existing.sourceLinks.push({
            sourceId: sourceEntity.id,
            description: extractedEntity.sourceDescription
          });
        }
      } else {
        const sourceLinks = [];
        if (sourceEntity && extractedEntity.sourceDescription) {
          sourceLinks.push({
            sourceId: sourceEntity.id,
            description: extractedEntity.sourceDescription
          });
        }

        const newEntity = Schema.createEntity({
          ...extractedEntity,
          captureId: this.pendingCapture.id,
          sourceLinks: sourceLinks
        });
        inv.entities.push(newEntity);
      }
    }

    // Merge relationships
    for (const extractedRel of (extraction.relationships || [])) {
      const sourceEntity = inv.entities.find(e =>
        e.name.toLowerCase() === extractedRel.source.toLowerCase()
      );
      const targetEntity = inv.entities.find(e =>
        e.name.toLowerCase() === extractedRel.target.toLowerCase()
      );

      if (sourceEntity && targetEntity) {
        const existingRel = inv.relationships.find(r =>
          r.sourceId === sourceEntity.id &&
          r.targetId === targetEntity.id &&
          r.type === extractedRel.type
        );

        if (existingRel) {
          existingRel.evidence.push(this.pendingCapture.id);
          existingRel.confidence = Math.min(1, existingRel.confidence + 0.1);

          // Add source support if available
          if (sourceEntity && extractedRel.sourceExplanation) {
            if (!existingRel.sourcesSupporting) existingRel.sourcesSupporting = [];
            existingRel.sourcesSupporting.push({
              sourceId: sourceEntity.id,
              explanation: extractedRel.sourceExplanation
            });
          }
        } else {
          const sourcesSupporting = [];
          if (sourceEntity && extractedRel.sourceExplanation) {
            sourcesSupporting.push({
              sourceId: sourceEntity.id,
              explanation: extractedRel.sourceExplanation
            });
          }

          const newRel = Schema.createRelationship({
            sourceId: sourceEntity.id,
            targetId: targetEntity.id,
            type: extractedRel.type,
            label: extractedRel.label || extractedRel.type,
            captureId: this.pendingCapture.id,
            confidence: extractedRel.confidence || 0.7,
            sourcesSupporting: sourcesSupporting
          });
          inv.relationships.push(newRel);
        }
      }
    }

    // Add exploration suggestions
    for (const suggestion of (extraction.explorationSuggestions || [])) {
      inv.explorationQueue.push(Schema.createExplorationSuggestion(suggestion));
    }

    await Store.saveInvestigation(inv);

    // Reset capture state
    this.discardExtraction();
    this.renderInvestigation();
    this.showStatus('success', '✅ Saved to investigation!');
  }

  discardExtraction() {
    this.pendingCapture = null;
    this.pendingExtraction = null;
    document.getElementById('capture-preview').classList.add('hidden');
    document.getElementById('extraction-results').classList.add('hidden');
    document.getElementById('extraction-status').classList.add('hidden');
  }

  resetCaptureTab() {
    this.discardExtraction();
  }

  // ===== Render Tabs =====

  renderEntitiesTab() {
    const inv = this.activeInvestigation;

    // Graph summary
    const summaryContainer = document.getElementById('entity-graph-summary');
    const typeCounts = {};
    inv.entities.forEach(e => {
      typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
    });

    summaryContainer.innerHTML = `
      <h3>Entity Network</h3>
      <div class="graph-stats">
        <div class="graph-stat">
          <div class="stat-value">${inv.entities.length}</div>
          <div class="stat-label">Entities</div>
        </div>
        <div class="graph-stat">
          <div class="stat-value">${inv.relationships.length}</div>
          <div class="stat-label">Connections</div>
        </div>
        <div class="graph-stat">
          <div class="stat-value">${inv.captures.length}</div>
          <div class="stat-label">Captures</div>
        </div>
      </div>
    `;

    // Entities
    const entitiesContainer = document.getElementById('all-entities');
    if (inv.entities.length === 0) {
      entitiesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🕸️</div>
          <p>No entities yet. Capture a page to start building the network.</p>
        </div>
      `;
    } else {
      entitiesContainer.innerHTML = inv.entities
        .sort((a, b) => b.occurrences.length - a.occurrences.length)
        .map(e => `
          <div class="entity-item" data-type="${e.type}">
            <div>
              <span class="entity-type-badge">${e.type}</span>
              <span class="entity-name">${e.name}</span>
              ${Object.keys(e.attributes).length ? `<div class="entity-detail">${Object.entries(e.attributes).map(([k,v]) => `${k}: ${v}`).join(' · ')}</div>` : ''}
              <div class="entity-occurrences">Seen in ${e.occurrences.length} capture(s)</div>
            </div>
          </div>
        `).join('');
    }

    // Relationships
    const relsContainer = document.getElementById('all-relationships');
    relsContainer.innerHTML = inv.relationships.map(r => {
      const source = inv.entities.find(e => e.id === r.sourceId);
      const target = inv.entities.find(e => e.id === r.targetId);
      return `
        <div class="relationship-item">
          <span class="rel-source">${source?.name || '?'}</span>
          <span class="rel-arrow">→</span>
          <span class="rel-type">${r.type}</span>
          <span class="rel-arrow">→</span>
          <span class="rel-target">${target?.name || '?'}</span>
        </div>
      `;
    }).join('');
  }

  renderSuggestionsTab() {
    const inv = this.activeInvestigation;
    const container = document.getElementById('exploration-queue');

    if (inv.explorationQueue.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💡</div>
          <p>No leads yet. Capture pages to get AI-powered investigation suggestions.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = inv.explorationQueue
      .filter(s => s.status === 'pending')
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .map(s => `
        <div class="suggestion-item ${s.priority}">
          <div class="suggestion-text">💡 ${s.suggestion}</div>
          <div class="suggestion-reason">${s.reason}</div>
          ${s.relatedHypothesis ? `<div class="suggestion-reason">📎 Related to: ${s.relatedHypothesis}</div>` : ''}
          <span class="suggestion-priority ${s.priority}">${s.priority}</span>
        </div>
      `).join('');
  }

  renderCapturesTab() {
    const inv = this.activeInvestigation;
    const container = document.getElementById('capture-history');

    if (inv.captures.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No captures yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = inv.captures
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(c => `
        <div class="capture-history-item">
          <img src="${c.imageData}" alt="Capture">
          <div class="capture-history-meta">
            ${c.captureType === 'region' ? '✂️' : '📸'} ${c.sourceUrl}<br>
            ${new Date(c.timestamp).toLocaleString()}
          </div>
        </div>
      `).join('');
  }

  // ===== Utilities =====

  showStatus(type, message) {
    const status = document.getElementById('extraction-status');
    status.className = `status ${type}`;
    status.textContent = message;
    status.classList.remove('hidden');
  }

  timeAgo(dateStr) {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  new InvestigationApp();
});
