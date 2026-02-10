// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureFullPage') {
    handleFullPageCapture(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.action === 'startRegionCapture') {
    handleRegionCapture(sendResponse);
    return true;
  }

  if (message.action === 'extractFromCapture') {
    handleExtraction(message, sendResponse);
    return true;
  }

  if (message.action === 'regionCaptureComplete') {
    // Forward from content script to popup
    chrome.runtime.sendMessage({
      action: 'regionCaptured',
      imageData: message.imageData,
      url: message.url,
      title: message.title
    });
    sendResponse({ success: true });
    return true;
  }
});

// ===== Full Page Capture (Screenshot + Text Extraction) =====

async function handleFullPageCapture(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Step 1: Capture viewport screenshot
    const imageData = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 90
    });

    // Step 2: Extract full page text from content script
    chrome.tabs.sendMessage(tab.id, { action: 'extractPageText' }, (response) => {
      if (chrome.runtime.lastError || response.error) {
        // If text extraction fails, still return the screenshot
        console.warn('Text extraction failed:', chrome.runtime.lastError || response.error);
        sendResponse({
          imageData: imageData,
          url: tab.url,
          title: tab.title,
          pageText: null,
          metadata: null
        });
        return;
      }

      // Return both screenshot and text
      sendResponse({
        imageData: imageData,
        url: response.url,
        title: response.title,
        pageText: response.pageText,
        metadata: response.metadata
      });
    });

  } catch (err) {
    sendResponse({ error: err.message });
  }
}

// ===== Region Capture =====

async function handleRegionCapture(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // First capture the full page
    const imageData = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 90
    });

    // Send to content script to let user select region
    chrome.tabs.sendMessage(tab.id, {
      action: 'selectRegion',
      imageData: imageData,
      url: tab.url,
      title: tab.title
    });

    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

// ===== LLM Extraction =====

async function handleExtraction(message, sendResponse) {
  try {
    const { imageData, pageText, metadata, investigation, settings } = message;

    const prompt = buildExtractionPrompt(investigation, pageText, metadata);
    const result = await callLLM(imageData, prompt, settings, pageText);

    sendResponse({ extraction: result });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

function buildExtractionPrompt(investigation, pageText, metadata) {
  const existingEntitiesText = investigation.existingEntities.length > 0
    ? investigation.existingEntities.map(e => `- ${e.name} (${e.type})`).join('\n')
    : 'None yet';

  const existingRelationshipsText = investigation.existingRelationships.length > 0
    ? investigation.existingRelationships.map(r => `- ${r.source} → ${r.type} → ${r.target}`).join('\n')
    : 'None yet';

  // Build page context section
  let pageContextSection = '';
  if (pageText || metadata) {
    pageContextSection = '\n\nPAGE CONTENT:\n';

    if (metadata) {
      pageContextSection += `URL: ${metadata.url}\n`;
      pageContextSection += `Title: ${metadata.title}\n`;
      if (metadata.description) pageContextSection += `Description: ${metadata.description}\n`;
      if (metadata.author) pageContextSection += `Author: ${metadata.author}\n`;
      if (metadata.publishedDate) pageContextSection += `Published: ${metadata.publishedDate}\n`;

      if (metadata.headings && metadata.headings.length > 0) {
        pageContextSection += `\nKey Headings:\n${metadata.headings.map(h => `${h.level}: ${h.text}`).join('\n')}\n`;
      }
    }

    if (pageText) {
      // Truncate very long text to avoid token limits
      const truncatedText = pageText.length > 15000 ? pageText.substring(0, 15000) + '\n\n[TEXT TRUNCATED...]' : pageText;
      pageContextSection += `\nFull Page Text:\n${truncatedText}\n`;
    }
  }

  return `You are an investigative research assistant helping a journalist build an entity network.

INVESTIGATION CONTEXT:
- Objective: ${investigation.objective}
- Hypotheses: ${investigation.hypotheses.join('; ') || 'None specified'}
- Signals of interest: ${investigation.signals.join('; ') || 'None specified'}

EXISTING ENTITY NETWORK:
Entities:
${existingEntitiesText}

Relationships:
${existingRelationshipsText}${pageContextSection}

TASK:
Analyze the provided screenshot and page content to extract ALL relevant information as structured data.

The screenshot shows the viewport (what's visible on screen), while the full page text contains the complete content including text below the fold. Use BOTH sources to build a comprehensive understanding.

CRITICAL: You MUST create a Source entity representing this captured page, and link ALL entities and relationships back to it with specific descriptions and explanations.

Return a JSON object with this EXACT structure:
{
  "source": {
    "name": "Title or identifier of this page/document",
    "url": "URL from metadata",
    "dateCollected": "Current date in ISO format (YYYY-MM-DD)",
    "publicationDate": "Publication date if mentioned on page (optional, ISO format)"
  },
  "entities": [
    {
      "name": "string - canonical name",
      "type": "person|organization|location|financial|date|identifier|asset|event",
      "aliases": ["array of alternative names/spellings"],
      "attributes": {"key": "value pairs of relevant details"},
      "relevanceScore": 0.0-1.0,
      "flags": ["array of flags like: key_figure, suspicious, recurring, etc."],
      "existingMatch": true/false,
      "sourceDescription": "REQUIRED: What this page specifically says about this entity - quote or summarize the relevant information"
    }
  ],
  "relationships": [
    {
      "source": "entity name",
      "target": "entity name",
      "type": "string describing relationship (e.g., director_of, owns, paid, located_at, associated_with)",
      "label": "human readable description",
      "confidence": 0.0-1.0,
      "sourceExplanation": "REQUIRED: How this page proves/supports this relationship - be specific with quotes or clear references to the content"
    }
  ],
  "explorationSuggestions": [
    {
      "suggestion": "what to investigate next",
      "reason": "why this is important given the investigation objective",
      "priority": "high|medium|low",
      "relatedHypothesis": "which hypothesis this relates to, if any",
      "relatedEntities": ["entity names involved"]
    }
  ],
  "summary": "Brief summary of what was found and how it relates to the investigation"
}

IMPORTANT RULES:
1. ALWAYS create a source object with the page information
2. EVERY entity MUST have a sourceDescription field explaining what this page says about it
3. EVERY relationship MUST have a sourceExplanation field proving how this page supports it
4. Match entities to existing ones in the network when possible (set existingMatch: true)
5. Use consistent entity names across the extraction
6. Prioritize information relevant to the investigation objective and hypotheses
7. Flag anything that supports or contradicts the hypotheses
8. Suggest concrete next steps for exploration
9. Be thorough - extract every entity and relationship from BOTH the image and text
10. Return ONLY valid JSON, no markdown formatting, no code blocks

EVIDENCE REQUIREMENTS:
- sourceDescription: Quote directly from the text or describe what you see in the image
- sourceExplanation: Reference specific sentences, paragraphs, or visual elements that prove the relationship
- Be specific - "The page states 'John Doe is CEO of ACME'" not just "mentioned as CEO"
- If the relationship is implied rather than explicit, explain the reasoning`;
}

async function callLLM(imageData, prompt, settings, pageText = null) {
  const endpoint = settings.endpoint || 'https://api.openai.com';
  const model = settings.model || 'gpt-4o';
  const apiKey = settings.apiKey;

  const url = `${endpoint}/v1/chat/completions`;

  const headers = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const body = {
    model: model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: imageData,
              detail: 'high'
            }
          }
        ]
      }
    ],
    max_tokens: 4096,
    temperature: 0.1,
    response_format: { type: "json_object" } // Force JSON output
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('LLM API error response:', errorBody);
    throw new Error(`LLM API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  // Check if the response has the expected structure
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('Unexpected API response structure:', data);
    throw new Error('LLM API returned unexpected response structure');
  }
  const content = data.choices[0].message.content;

  // Parse JSON from response with multiple fallback strategies
  let parsed;

  // Strategy 1: Direct JSON parse
  try {
    parsed = JSON.parse(content);
    return parsed;
  } catch (e) {
    console.log('Direct JSON parse failed, trying fallbacks...');
  }

  // Strategy 2: Extract from markdown code blocks (```json or ```)
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
      return parsed;
    }
  } catch (e) {
    console.log('Markdown extraction failed, trying next fallback...');
  }

  // Strategy 3: Find JSON object boundaries
  try {
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonStr = content.substring(firstBrace, lastBrace + 1);
      parsed = JSON.parse(jsonStr);
      return parsed;
    }
  } catch (e) {
    console.log('JSON boundary extraction failed');
  }

  // All strategies failed - log the raw response for debugging
  console.error('Failed to parse LLM response. Raw content:', content);
  throw new Error(`Failed to parse LLM response as JSON. Response preview: ${content.substring(0, 200)}...`);
}
