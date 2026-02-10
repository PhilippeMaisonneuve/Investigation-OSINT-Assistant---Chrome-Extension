# Recent Changes

## Region Capture Improvements

### Fixed Issues:
1. ✅ **Zoom Fix** - Region captures are now at the correct resolution (no more zoomed-in images)
2. ✅ **Visual Feedback** - Badge notification (blue "1") appears on extension icon when region capture is ready
3. ✅ **Manual Control** - Added explicit "Load Pending Region Capture" button for better UX

### How It Works Now:

1. **Start Region Capture**
   - Click "Select Region" button
   - Popup closes (normal behavior)
   - Draw your selection on the page
   - Badge "1" appears on extension icon

2. **Load the Capture**
   - Click extension icon to reopen
   - You'll see a blue "📥 Load Pending Region Capture" button
   - Click it to process the capture
   - AI will analyze and extract entities

### Why These Changes:

- **Badge notification**: So you know when a capture is ready
- **Manual button**: Gives you control over when processing happens
- **Better reliability**: Handles timing issues with popup lifecycle

### Testing Steps:

1. Reload extension in `chrome://extensions/`
2. Open an investigation
3. Click "Select Region"
4. Draw a region on any page
5. Look for badge "1" on extension icon
6. Click extension icon
7. Click "📥 Load Pending Region Capture"
8. Watch it process!

### Console Logs to Check:

Open browser console (F12) when you reopen the popup. You should see:
- "Checking for pending region capture..."
- "Found pending capture! Showing load button..."
- "Loading pending region capture..." (after clicking button)
