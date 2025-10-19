const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

let panel = null;
let messageCounter = 0;

function activate(context) {
  // #region Commands (VSCODE -> EXTENSION)
  // Register openPanel command
  const openPanelCmd = vscode.commands.registerCommand('demo.openPanel', () => {
    openPanel(context);
  });

  // Register sendMessage command
  const sendMessageCmd = vscode.commands.registerCommand(
    'demo.sendMessage',
    () => {
      sendMessage(context);
    }
  );
  // #endregion Commands (VSCODE -> EXTENSION)

  context.subscriptions.push(openPanelCmd, sendMessageCmd);
}

function openPanel(context) {
  // If panel already exists, reveal it
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    return;
  }

  // Create new webview panel
  panel = vscode.window.createWebviewPanel(
    'reactWebviewDemo',
    'Webview Demo',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'media')),
      ],
    }
  );

  // Set HTML content
  panel.webview.html = getWebviewContent(panel.webview, context.extensionPath);

  // #region Messages (WEBVIEW -> EXTENSION)
  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    (message) => {
      if (message.type === 'notify') {
        //  Extension -> VSCODE
        vscode.window.showInformationMessage(message.text);
      }
    },
    undefined,
    context.subscriptions
  );
  // #endregion Messages (WEBVIEW -> EXTENSION)
  // Clean up when panel is disposed
  panel.onDidDispose(
    () => {
      panel = null;
    },
    null,
    context.subscriptions
  );
}

function sendMessage(context) {
  // If panel doesn't exist, open it first
  if (!panel) {
    openPanel(context);
    // Wait a moment for panel to initialize
    setTimeout(() => {
      sendMessageToPanel();
    }, 500);
  } else {
    sendMessageToPanel();
  }
}

function sendMessageToPanel() {
  if (panel) {
    messageCounter++;
    const timestamp = new Date().toLocaleTimeString();
    //  Extension -> WEBVIEW
    panel.webview.postMessage({
      type: 'hostMessage',
      text: `Message #${messageCounter} at ${timestamp}`,
    });
  }
}

function getWebviewContent(webview, extensionPath) {
  const mediaPath = path.join(extensionPath, 'media');
  const indexPath = path.join(mediaPath, 'index.html');

  // Read the built index.html
  let html = fs.readFileSync(indexPath, 'utf8');

  // Generate nonce for CSP
  const nonce = getNonce();

  // Convert asset paths to webview URIs
  html = html.replace(/(href|src)="([^"]+)"/g, (match, attr, assetPath) => {
    if (assetPath.startsWith('http') || assetPath.startsWith('//')) {
      return match;
    }
    // Remove leading ./ or /
    const cleanPath = assetPath.replace(/^\.?\//, '');
    const assetUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, cleanPath))
    );
    return `${attr}="${assetUri}"`;
  });

  // Add CSP meta tag with nonce
  const cspContent = `
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}';
    img-src ${webview.cspSource} https:;
    font-src ${webview.cspSource};
  `
    .replace(/\s+/g, ' ')
    .trim();

  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`;

  // Insert CSP meta tag in head
  html = html.replace('<head>', `<head>\n    ${cspMeta}`);

  // Add nonce to script tags
  html = html.replace(/<script/g, `<script nonce="${nonce}"`);

  return html;
}

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function deactivate() {
  if (panel) {
    panel.dispose();
  }
}

module.exports = {
  activate,
  deactivate,
};
