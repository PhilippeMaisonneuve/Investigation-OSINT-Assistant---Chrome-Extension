const Store = {
  async getSettings() {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {
      llmProvider: 'openai',
      apiKey: '',
      endpoint: 'https://api.openai.com',
      model: 'gpt-4o',
      googleApiKey: '',
      googleCx: '',
      firecrawlApiKey: ''
    };
  },

  async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  },

  async getInvestigationList() {
    const result = await chrome.storage.local.get('investigationIndex');
    return result.investigationIndex || [];
  },

  async getInvestigation(id) {
    const result = await chrome.storage.local.get(id);
    return result[id] || null;
  },

  async saveInvestigation(investigation) {
    investigation.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ [investigation.id]: investigation });

    const index = await this.getInvestigationList();
    const existing = index.findIndex(i => i.id === investigation.id);
    const summary = {
      id: investigation.id,
      title: investigation.title,
      entityCount: investigation.entities.length,
      captureCount: investigation.captures.length,
      updatedAt: investigation.updatedAt
    };

    if (existing >= 0) {
      index[existing] = summary;
    } else {
      index.push(summary);
    }
    await chrome.storage.local.set({ investigationIndex: index });
  },

  async getActiveInvestigationId() {
    const result = await chrome.storage.local.get('activeInvestigationId');
    return result.activeInvestigationId || null;
  },

  async setActiveInvestigationId(id) {
    await chrome.storage.local.set({ activeInvestigationId: id });
  },

  async deleteInvestigation(id) {
    await chrome.storage.local.remove(id);
    const index = await this.getInvestigationList();
    const filtered = index.filter(i => i.id !== id);
    await chrome.storage.local.set({ investigationIndex: filtered });
  },

  // Conversation methods
  async getConversationList(investigationId) {
    const result = await chrome.storage.local.get('conversationIndex');
    const allConversations = result.conversationIndex || [];
    return investigationId
      ? allConversations.filter(c => c.investigationId === investigationId)
      : allConversations;
  },

  async getConversation(id) {
    const result = await chrome.storage.local.get(id);
    return result[id] || null;
  },

  async saveConversation(conversation) {
    conversation.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ [conversation.id]: conversation });

    const index = await this.getConversationList();
    const existing = index.findIndex(c => c.id === conversation.id);
    const summary = {
      id: conversation.id,
      investigationId: conversation.investigationId,
      title: conversation.title,
      messageCount: conversation.messages.length,
      lastMessage: conversation.messages.length > 0
        ? conversation.messages[conversation.messages.length - 1].content.substring(0, 100)
        : '',
      updatedAt: conversation.updatedAt
    };

    if (existing >= 0) {
      index[existing] = summary;
    } else {
      index.push(summary);
    }
    await chrome.storage.local.set({ conversationIndex: index });
  },

  async deleteConversation(id) {
    await chrome.storage.local.remove(id);
    const index = await this.getConversationList();
    const filtered = index.filter(c => c.id !== id);
    await chrome.storage.local.set({ conversationIndex: filtered });
  }
};
