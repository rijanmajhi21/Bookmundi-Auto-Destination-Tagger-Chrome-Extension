# Bookmundi Map Auto-Tagger

A Chrome extension that automatically tags end destinations from day sections on Bookmundi map pages.

## Features

- 📅 **Day Section Detection**: Automatically detects Day 1, Day 2, etc. sections on Bookmundi pages
- 🏷️ **End Destination Extraction**: Extracts the end destination from each day:
  - From day titles like "Day 4 Granada, Tangier, Asilah, Rabat" → extracts "Rabat"
  - From "Destination:" fields like "Madrid, Spain" → extracts "Madrid"
- ⌨️ **Auto-Fill Inputs**: Automatically fills location input fields with extracted destinations
- 🔍 **Smart Dropdown Selection**: Automatically selects matching locations from autocomplete dropdowns
- 📊 **Tag History**: View history of all tagged locations
- 🎯 **Manual Tagging**: Option to manually trigger tagging with a single click

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `map-tagger` directory
6. The extension should now be installed!

## Usage

1. Navigate to a Bookmundi map page : map makeup
2. Click the extension icon in your Chrome toolbar
3. Toggle "Auto-tag maps" to enable automatic tagging
4. The extension will:
   - Find all day sections (Day 1, Day 2, etc.)
   - Extract end destinations from each day
   - Auto-fill location input fields
   - Select matching locations from dropdowns if available
5. Use "Tag Map Now" to manually trigger tagging
6. Click "View History" to see all tagged locations

## How It Works

The extension:

1. **Detects Day Sections**: Scans the page for elements containing "Day 1", "Day 2", etc.
2. **Extracts End Destinations**: 
   - From day titles: "Day 4 Granada, Tangier, Asilah, Rabat" → extracts "Rabat" (last location)
   - From "Destination:" fields: "Madrid, Spain" → extracts "Madrid" (city name)
3. **Finds Location Inputs**: Identifies input fields related to location tagging
4. **Auto-Fills**: Types the destination into the input field character by character to trigger autocomplete
5. **Selects from Dropdown**: Automatically clicks matching options in autocomplete dropdowns
6. **Stores History**: Saves all tagged locations locally for reference

## File Structure

```
map-tagger/
├── manifest.json       # Extension manifest (Manifest V3)
├── background.js       # Background service worker
├── content.js         # Content script (runs on Bookmundi pages)
├── content.css        # Styles for visual indicators
├── popup.html         # Extension popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup functionality
├── icons/             # Extension icons (you'll need to add these)
└── README.md          # This file
```

## Icons

You'll need to add icon files to the `icons/` directory:

- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can create simple icons or use an icon generator.

## Permissions

The extension requires:

- **activeTab**: To interact with the current tab
- **storage**: To save settings and tagged map history
- **scripting**: To inject content scripts
- **host_permissions**: Access to Bookmundi domains

## Development

To modify the extension:

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## Customization

You can customize the extension behavior by modifying `content.js`:

- **Day Detection**: Adjust `findDaySections()` to match your page structure
- **Destination Extraction**: Modify `extractEndDestination()` to handle different formats
- **Input Detection**: Update `findLocationInputs()` to target specific input fields
- **Dropdown Selection**: Enhance `selectFromDropdown()` for different autocomplete implementations

## License

MIT License - feel free to use and modify as needed.

## Support

For issues or questions, please check the code comments or modify the selectors in `content.js` to match your specific use case.
