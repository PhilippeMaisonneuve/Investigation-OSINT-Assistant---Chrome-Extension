# 🔍 Investigation Assistant

A powerful browser extension for investigative journalists and researchers that automatically builds knowledge graphs from web content using AI. Capture pages, extract entities and relationships, and discover hidden connections with autonomous web research capabilities.

## 🌟 Features

### Core Capabilities
- **📸 Smart Page Capture** - Capture any webpage with full text extraction and screenshot
- **🧠 AI Entity Extraction** - Automatically identify people, organizations, locations, financial entities, and their relationships
- **🕸️ Interactive Knowledge Graph** - Visualize connections with force-directed graph layout
- **📚 Source Provenance** - Every piece of information is linked back to its source with full citations
- **💬 AI Assistant** - Ask questions about your investigation and get intelligent answers

### Advanced Features
- **🔍 Autonomous Web Research** - AI automatically searches Google and scrapes relevant pages when information is missing
- **🎯 Fuzzy Matching** - Handles spelling variations and typos automatically
- **🛤️ Path Finding** - Discover multi-hop connections between distant entities
- **💾 Multiple Investigations** - Manage separate investigations with their own graphs
- **🗨️ Conversation History** - Save and resume conversations with the AI

## 📋 Prerequisites

- Google Chrome or Chromium-based browser
- OpenAI API key (for entity extraction and AI assistant)
- **Optional for web research:**
  - Google Custom Search API key
  - Firecrawl API key

## 🚀 Installation

### 1. Generate Icons

Open `icons/create-icons.html` in your browser and download the three generated icons to the `icons/` folder:
- icon16.png
- icon48.png
- icon128.png

### 2. Load the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the extension folder

### 3. Configure API Keys

1. Click the extension icon in your browser toolbar
2. Click the ⚙️ Settings button
3. Configure your API keys:

**Required:**
- **API Endpoint**: `https://api.openai.com` (or your custom endpoint)
- **API Key**: Your OpenAI API key (starts with `sk-...`)
- **Model**: `gpt-4o` (or `gpt-4o-mini`, `o1-preview`, etc.)

**Optional (for autonomous web research):**
- **Google Search API Key**: Get from [Google Custom Search API](https://developers.google.com/custom-search/v1/overview)
- **Google Custom Search Engine ID**: Create at [Programmable Search Engine](https://programmablesearchengine.google.com/)
- **Firecrawl API Key**: Get from [Firecrawl](https://firecrawl.dev)

4. Click "Save Settings"

## 📖 User Guide

### Creating an Investigation

1. Click the extension icon
2. Click "+ New Investigation"
3. Fill in:
   - **Title**: Name your investigation (e.g., "Shell Company Network")
   - **Objective**: What are you trying to uncover?
   - **Hypotheses**: Add theories to test (optional)
   - **Signals**: Keywords or patterns to watch for (optional)
4. Click "Start Investigation"

### Capturing Web Pages

1. Navigate to any webpage you want to analyze
2. Open the extension popup
3. Click "📸 Capture Page"
4. Wait for AI extraction (10-30 seconds)
5. Review extracted entities and relationships
6. Click "Save to Investigation"

**What gets captured:**
- Full page text content
- Screenshot of visible area
- Page metadata (title, URL, date)
- Automatically extracted entities (people, organizations, etc.)
- Relationships between entities
- Source provenance linking everything back to the URL

### Viewing Your Knowledge Graph

1. Open the extension popup
2. Navigate to the "🕸️ Entities" tab
3. Click "View Graph Visualization"

**Graph Controls:**
- **Pan**: Click and drag background
- **Zoom**: Mouse wheel
- **Select Node**: Click on any entity
- **Fit View**: Center and zoom to fit all nodes

### Adding Entities Manually

1. In the graph view, click "➕ Add Entity"
2. Fill in:
   - **Name**: Entity name
   - **Type**: person, organization, location, financial, etc.
   - **Aliases**: Alternate names (comma-separated)
   - **Notes**: Additional context

**For Source entities:**
- Select type "source"
- Add URL, collection date, and optional publication date

### Creating Relationships Manually

1. Click "🔗 Add Relationship" button
2. Click the **source** entity (first node)
3. Click the **target** entity (second node)
4. In the modal:
   - **Type**: Relationship type (e.g., `works_for`, `owns`, `director_of`)
   - **Label**: Human-readable description
   - **Confidence**: 0.0 to 1.0 (how certain you are)
   - **Add Sources**: Link supporting source documents
5. Click "Save Relationship"

### Using the AI Assistant

1. In the graph view, click "💬 Chat" button
2. Ask questions like:
   - "What is the relationship between Julie Payette and Plug and Play?"
   - "Who are all the directors of TechCorp?"
   - "What companies does Philippe Maisonneuve work for?"
   - "Find all connections to the Maisonneuve family"

**The AI can:**
- Find shortest paths between entities
- Answer questions about the graph
- Infer new relationships from existing data
- **Search the web** when information is missing
- **Automatically add discoveries** to your graph
- Adjust confidence scores
- Remove incorrect information

### Autonomous Web Research

When you ask a question the AI can't answer with current graph data, it will:

1. 🔍 **Search Google** for relevant information
2. 📄 **Scrape promising pages** with Firecrawl
3. 🧠 **Extract entities** and relationships
4. ➕ **Add to graph** with full source provenance
5. 💬 **Answer your question** with citations

**Example:**
```
You: "What company does John Smith work for?"

AI: 🔍 Searching web: "John Smith company employment"
    ✓ Found 5 search results
    📄 Scraping webpage: https://example.com/about
    ✓ Extracted 3 entities and 2 relationships
    ➕ Adding discoveries to graph...
    ✓ Added 2 new entities and 1 new relationship

    John Smith works for Acme Corp as Chief Technology Officer.

    Source: Information discovered from https://example.com/about
    and added to the graph.
```

### Managing Conversations

The AI assistant supports multiple conversation threads:

- **New Conversation**: Click ➕ button
- **Switch Conversations**: Use dropdown menu
- **Delete Conversation**: Click 🗑️ button
- **Auto-save**: Conversations save automatically
- **Auto-title**: First message becomes conversation title

### Exploring Entity Details

Click any entity in the graph to view:
- **Attributes**: All metadata
- **Aliases**: Alternate names
- **Flags**: Origin markers (manual, ai-created, web-research)
- **Connections**: All relationships
- **Sources**: Where this information came from
- **Statistics**: Occurrence count, relevance score

## 🎯 Best Practices

### For Accurate Extraction

1. **Capture relevant pages**: Focus on pages with structured information (about pages, press releases, corporate filings)
2. **Review before saving**: Always check extracted entities for accuracy
3. **Add context manually**: Supplement AI extraction with manual entities for important details
4. **Link to sources**: Always attach source documents to relationships

### For Effective Research

1. **Start with known entities**: Manually add key people/organizations you're investigating
2. **Capture systematically**: Work through related pages methodically
3. **Use the AI assistant**: Ask questions to discover connections you might miss
4. **Set confidence scores**: Mark uncertain relationships with lower confidence
5. **Document hypotheses**: Use the hypothesis feature to track theories

### For Graph Quality

1. **Avoid duplicates**: Check for existing entities before creating new ones
2. **Use consistent naming**: "John Smith" not "J. Smith" or "Smith, John"
3. **Add aliases**: Include all name variations as aliases on one entity
4. **Clean as you go**: Use AI to remove incorrect relationships
5. **Add explanations**: Include context in relationship explanations

## 🔧 Troubleshooting

### Common Issues

**"API error: 401"**
- Check your API key is correct
- Verify the endpoint URL matches your provider
- For OpenAI: Ensure your account has credits

**"Entity not found" in AI queries**
- Entity names are fuzzy-matched (spelling variations OK)
- Check entity exists in graph
- Try using partial name or alias

**Extraction taking too long**
- Large pages may take 30+ seconds
- Check your internet connection
- Try with a faster model (gpt-4o-mini)

**Graph is too cluttered**
- Use the "Fit View" button to center the graph
- Click and drag to pan to different areas
- Zoom in to focus on specific clusters

**Web research not working**
- Verify Google Search API key is configured
- Verify Firecrawl API key is configured
- Check API quotas (Google: 100 free searches/day)
- Ensure API keys have correct permissions

**Extension not capturing**
- Refresh the page and try again
- Check browser console for errors
- Verify extension has permissions for the site

## 🎓 Example Workflows

### Investigating a Company Network

1. Create investigation: "Shell Company Investigation"
2. Capture company "About" page
3. Capture board member bio pages
4. Ask AI: "Who are all the directors?"
5. Ask AI: "Find connections between [Director A] and [Director B]"
6. Let AI search web for additional director information
7. Export findings with full source citations

### Mapping Financial Relationships

1. Capture financial disclosure documents
2. Manually add key entities (companies, individuals)
3. Create ownership relationships
4. Ask AI: "Who ultimately controls [Company X]?"
5. Use path finding to discover multi-hop ownership chains
6. Verify with AI web research

### Tracking People Networks

1. Capture LinkedIn profiles, news articles, press releases
2. Focus on employment, education, family relationships
3. Ask AI: "What connections exist between [Person A] and [Organization B]?"
4. Let AI search for additional biographical information
5. Build complete relationship map with dates and sources

## 📊 Entity Types

- **person**: Individuals
- **organization**: Companies, nonprofits, government agencies
- **location**: Cities, countries, addresses
- **financial**: Transactions, accounts, amounts
- **date**: Specific dates or time periods
- **identifier**: IDs, registration numbers, codes
- **asset**: Property, IP, physical assets
- **event**: Meetings, transactions, incidents
- **source**: Documents, web pages, databases

## 🔗 Relationship Types

Common relationship types (use any that fit):
- `works_for`, `employed_by`
- `director_of`, `board_member`
- `owns`, `owned_by`
- `subsidiary_of`, `parent_company`
- `partner_of`, `affiliated_with`
- `located_in`, `based_in`
- `founded_by`, `founder`
- `invested_in`, `investor_of`
- `related_to`, `connected_to`
- `awarded_by`, `recipient_of`

## 💡 Tips & Tricks

### Keyboard Shortcuts
- **Enter** in chat: Send message
- **Esc**: Close panels

### Search Operators
- Use quotes for exact phrases: `"exact company name"`
- Combine entity names: `"John Smith" "Acme Corp"`
- Add context: `"John Smith" CEO technology`

### Graph Navigation
- **Double-click** background to deselect
- **Zoom to specific area** then adjust manually
- **Use entity panel** for detailed information

### AI Assistant
- Ask follow-up questions in same conversation
- Reference previous answers: "Tell me more about that connection"
- Be specific: "What is John's role at Acme?" vs "Tell me about John"
- Let AI search when needed: "Find information about X's employment history"

## 🔒 Privacy & Security

- **All data stored locally** in your browser (Chrome storage API)
- **No telemetry** or tracking
- **API keys stored locally** (never transmitted except to configured endpoints)
- **Source URLs preserved** for audit trail
- **Web research respects robots.txt** (via Firecrawl)

## 🏗️ Architecture

```
investigation-extension/
├── manifest.json              # Extension configuration
├── popup/                     # Main UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── dashboard/                 # Graph visualization
│   ├── dashboard.html
│   ├── dashboard.css
│   └── dashboard.js
├── background/                # Background service worker
│   └── service-worker.js
├── content/                   # Content scripts
│   ├── content.js
│   └── content.css
├── shared/                    # Shared utilities
│   ├── schema.js             # Data models
│   └── store.js              # Storage layer
└── icons/                     # Extension icons
```

## 🛠️ Development

Built with:
- Vanilla JavaScript (no build step required)
- Chrome Extension Manifest V3
- Canvas-based graph rendering with force-directed layout
- OpenAI API for LLM (entity extraction and reasoning)
- Google Custom Search API for web search
- Firecrawl API for web scraping



#
