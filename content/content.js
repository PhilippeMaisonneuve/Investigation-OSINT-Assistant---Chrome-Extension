let regionOverlay = null;
let isSelecting = false;
let startX = 0;
let startY = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'selectRegion') {
    startRegionSelection(message.imageData, message.url, message.title);
    sendResponse({ success: true });
  }

  if (message.action === 'extractPageText') {
    extractFullPageText(sendResponse);
    return true; // Keep channel open for async response
  }

  return true;
});

// ===== Full Page Text Extraction =====

function extractFullPageText(sendResponse) {
  try {
    // Extract all text content from the page
    const pageText = document.body.innerText || document.body.textContent || '';

    // Extract metadata
    const metadata = {
      title: document.title,
      url: window.location.href,
      description: document.querySelector('meta[name="description"]')?.content || '',
      keywords: document.querySelector('meta[name="keywords"]')?.content || '',
      author: document.querySelector('meta[name="author"]')?.content || '',
      publishedDate: document.querySelector('meta[property="article:published_time"]')?.content ||
                      document.querySelector('meta[name="date"]')?.content || '',

      // Extract visible links
      links: Array.from(document.querySelectorAll('a[href]'))
        .slice(0, 50) // Limit to first 50 links to avoid huge payloads
        .map(a => ({
          text: a.innerText.trim(),
          href: a.href
        }))
        .filter(link => link.text && link.href),

      // Extract headings structure
      headings: Array.from(document.querySelectorAll('h1, h2, h3'))
        .slice(0, 30) // Limit to first 30 headings
        .map(h => ({
          level: h.tagName,
          text: h.innerText.trim()
        }))
        .filter(h => h.text),

      // Page statistics
      wordCount: pageText.split(/\s+/).length,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight
    };

    sendResponse({
      pageText: pageText,
      metadata: metadata,
      url: window.location.href,
      title: document.title
    });

  } catch (err) {
    console.error('Text extraction failed:', err);
    sendResponse({ error: `Text extraction failed: ${err.message}` });
  }
}

function startRegionSelection(fullImageData, url, title) {
  // Remove any existing overlay
  removeOverlay();

  // Create overlay
  regionOverlay = document.createElement('div');
  regionOverlay.id = 'investigation-region-overlay';

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  regionOverlay.appendChild(canvas);

  // Instructions
  const instructions = document.createElement('div');
  instructions.id = 'investigation-region-instructions';
  instructions.textContent = 'Click and drag to select a region · Press Escape to cancel';
  regionOverlay.appendChild(instructions);

  document.body.appendChild(regionOverlay);

  const ctx = canvas.getContext('2d');

  // Load the full screenshot as background
  const img = new Image();
  img.onload = () => {
    // Draw semi-transparent overlay
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  img.src = fullImageData;

  let currentX = 0;
  let currentY = 0;

  function onMouseDown(e) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
  }

  function onMouseMove(e) {
    if (!isSelecting) return;

    currentX = e.clientX;
    currentY = e.clientY;

    // Redraw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw selected region (clear the dark overlay to show the image)
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    // Draw the clear region
    ctx.drawImage(img, x, y, w, h, x, y, w, h);

    // Draw border around selection
    ctx.strokeStyle = '#6c72cb';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, w, h);
  }

  function onMouseUp(e) {
    if (!isSelecting) return;
    isSelecting = false;

    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    if (w < 10 || h < 10) {
      removeOverlay();
      return;
    }

    // Crop the region
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w * window.devicePixelRatio;
    cropCanvas.height = h * window.devicePixelRatio;
    const cropCtx = cropCanvas.getContext('2d');

    // Scale for device pixel ratio
    const scaleX = img.naturalWidth / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;

    cropCtx.drawImage(
      img,
      x * scaleX, y * scaleY, w * scaleX, h * scaleY,
      0, 0, cropCanvas.width, cropCanvas.height
    );

    const croppedData = cropCanvas.toDataURL('image/png');

    // Send back to extension
    chrome.runtime.sendMessage({
      action: 'regionCaptureComplete',
      imageData: croppedData,
      url: url,
      title: title
    });

    removeOverlay();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      removeOverlay();
    }
  }

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);

  // Store cleanup references
  regionOverlay._cleanup = () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown);
  };
}

function removeOverlay() {
  if (regionOverlay) {
    if (regionOverlay._cleanup) regionOverlay._cleanup();
    regionOverlay.remove();
    regionOverlay = null;
  }
}
