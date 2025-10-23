# VS Code React Webview Demo

A complete VS Code extension demonstrating two-way communication between the extension host and a React webview panel.

## Features

- **Three commands:**
  - `Demo: Open Panel` - Opens a React-powered webview panel (tab or bottom panel based on settings)
  - `Demo: Send Message` - Sends a timestamped message to the webview panel
  - `Demo: Toggle Panel Location` - Switches the panel between tab and bottom panel
- **Flexible panel location:**
  - Display the panel as an editor tab or in the bottom panel area
  - Toggle location via command or button in the webview
  - Location preference is saved in VS Code settings
- **Two-way communication:**
  - Extension → Webview: Send messages that display in the React UI
  - Webview → Extension: Button clicks trigger VS Code notifications and actions

## Prerequisites

- Node.js 18+
- VS Code 1.80.0 or higher
- `@vscode/vsce` (optional, for packaging)

## Setup & Build

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Build the webview:**
   ```bash
   npm run build
   ```
   This will:
   - Install webview-ui dependencies
   - Build the React app with Vite
   - Copy built assets to the `media/` folder

## Running the Extension

1. **Open in VS Code:**

   ```bash
   code .
   ```

2. **Press F5** to launch the Extension Development Host

3. **In the new window:**

   - Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
   - Run: `Demo: Open Panel`
   - A tabbed panel opens with the React UI

4. **Test two-way communication:**

   - Run `Demo: Send Message` from Command Palette → text updates in panel
   - Click "Notify in VS Code" button in panel → notification appears

5. **Toggle panel location:**
   - Click "Toggle Panel Location" button in the webview
   - Or run `Demo: Toggle Panel Location` from Command Palette
   - Panel switches between tab and bottom panel

## Project Structure

```
vscode-react-webview-demo/
├── extension.js          # Extension activation & command handlers
├── package.json          # Extension manifest
├── media/                # Built webview assets (generated)
└── webview-ui/           # React app source
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx      # React entry point
        └── App.jsx       # Main React component
```

## Packaging

To create a `.vsix` package:

```bash
npm run package
```

This requires `@vscode/vsce` (included as dev dependency).

## Troubleshooting

### CSP Warnings

If you see Content Security Policy errors in the webview console:

- Check that `extension.js` correctly adds nonce attributes to script tags
- Verify `webview.cspSource` is included in the CSP meta tag

### Assets Not Loading

If CSS/JS don't load in the webview:

- Ensure `npm run build` completed successfully
- Check that `media/` folder contains `index.html` and asset files
- Verify `vite.config.js` has `base: './'` so paths are relative

### Webview Not Receiving Messages

- Confirm the panel is open before sending messages
- Check browser console in webview (Help → Toggle Developer Tools → inspect webview)
- Verify `window.addEventListener('message', ...)` is set up in React app

## Development Notes

- **No TypeScript:** All code is plain JavaScript
- **No Webpack:** Uses Vite for fast React builds
- **No state management libraries:** Vanilla React hooks
- **CSP-compliant:** Proper nonce-based script loading
- **Asset handling:** All paths converted via `asWebviewUri` for security

## Commands

- `elk.openPanel` - Opens/reveals the webview panel
- `elk.sendMessage` - Sends a message to the panel (opens it if needed)
- `elk.togglePanelLocation` - Toggles the panel between tab and bottom panel

## Configuration

- `elk.panelLocation` - Set where the panel opens: `"tab"` (default) or `"bottom"`

## License

MIT
