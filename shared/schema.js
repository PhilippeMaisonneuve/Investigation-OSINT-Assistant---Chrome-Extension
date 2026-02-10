const Schema = {
  createInvestigation(data) {
    return {
      id: `inv_${Date.now()}`,
      title: data.title || 'Untitled Investigation',
      objective: data.objective || '',
      hypotheses: data.hypotheses || [],
      signals: data.signals || [],
      entityTypes: data.entityTypes || ['person', 'organization', 'location', 'financial', 'date', 'identifier', 'asset', 'event', 'source'],
      entities: [],
      relationships: [],
      captures: [],
      explorationQueue: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  createEntity(data) {
    return {
      id: `ent_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: data.type || 'unknown',
      name: data.name || '',
      aliases: data.aliases || [],
      attributes: data.attributes || {},
      firstSeen: data.captureId || null,
      occurrences: data.captureId ? [data.captureId] : [],
      relevanceScore: data.relevanceScore || 0,
      flags: data.flags || [],
      notes: data.notes || '',
      sourceLinks: data.sourceLinks || [] // Links to Source entities with descriptions
    };
  },

  createRelationship(data) {
    return {
      id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sourceId: data.sourceId,
      targetId: data.targetId,
      type: data.type || 'related_to',
      label: data.label || '',
      evidence: data.captureId ? [data.captureId] : [],
      confidence: data.confidence || 0.5,
      attributes: data.attributes || {},
      sourcesSupporting: data.sourcesSupporting || [] // Array of {sourceId, explanation}
    };
  },

  createCapture(data) {
    return {
      id: `cap_${Date.now()}`,
      imageData: data.imageData,
      sourceUrl: data.sourceUrl || '',
      pageTitle: data.pageTitle || '',
      captureType: data.captureType || 'full',
      pageText: data.pageText || null,
      metadata: data.metadata || null,
      timestamp: new Date().toISOString(),
      extractedEntities: [],
      extractedRelationships: [],
      rawExtraction: null,
      notes: data.notes || ''
    };
  },

  createExplorationSuggestion(data) {
    return {
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      suggestion: data.suggestion || '',
      reason: data.reason || '',
      priority: data.priority || 'medium',
      relatedHypothesis: data.relatedHypothesis || null,
      relatedEntities: data.relatedEntities || [],
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  },

  createConversation(data) {
    return {
      id: `conv_${Date.now()}`,
      investigationId: data.investigationId,
      title: data.title || 'New Conversation',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  createMessage(data) {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: data.type || 'user',
      content: data.content || '',
      reasoning: data.reasoning || null,
      actions: data.actions || null,
      timestamp: new Date().toISOString()
    };
  }
};

if (typeof module !== 'undefined') module.exports = Schema;
