const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

let panel = null;
let webviewView = null;
let messageCounter = 0;
let notifyCounter = 0;

function activate(context) {
  // #region WebviewView Provider (for bottom panel)
  const provider = new DemoWebviewViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('demo.bottomPanel', provider)
  );
  // #endregion WebviewView Provider

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
  const config = vscode.workspace.getConfiguration('demo');
  const panelLocation = config.get('panelLocation', 'tab');

  if (panelLocation === 'bottom') {
    // Open the bottom panel view
    vscode.commands.executeCommand('demo.bottomPanel.focus');
  } else {
    // Open as tab (existing behavior)
    openTabPanel(context);
  }
}

function openTabPanel(context) {
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
      handleWebviewMessage(message);
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
  const config = vscode.workspace.getConfiguration('demo');
  const panelLocation = config.get('panelLocation', 'tab');

  // If neither panel exists, open it first
  if (!panel && !webviewView) {
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
  messageCounter++;
  const timestamp = new Date().toLocaleTimeString();
  const message = {
    type: 'hostMessage',
    text: `Message #${messageCounter} at ${timestamp}`,
  };

  //  Extension -> WEBVIEW
  if (panel) {
    panel.webview.postMessage(message);
  } else if (webviewView) {
    webviewView.webview.postMessage(message);
  }
}

function handleWebviewMessage(message) {
  console.log('[Extension] Received message from webview:', message);

  if (message.type === 'notify') {
    //  Extension -> VSCODE
    notifyCounter++;
    const timestamp = new Date().toLocaleTimeString();
    const notificationText = `${message.text} - #${notifyCounter} at ${timestamp}`;
    console.log('[Extension] Showing notification:', notificationText);
    vscode.window.showInformationMessage(notificationText);
  } else if (message.type === 'openFile') {
    // Handle opening file and executing select
    console.log('[Extension] Opening file:', message.fileName);
    openFileAndSelect(message.fileName).catch((error) => {
      console.error('[Extension] Error opening file:', error);
      vscode.window.showErrorMessage(`Error: ${error.message}`);
    });
  } else if (message.type === 'goToLineColumn') {
    // Handle going to a specific line and column
    console.log(
      '[Extension] Going to line:',
      message.line,
      'column:',
      message.column
    );
    goToLineColumn(message.line, message.column).catch((error) => {
      console.error('[Extension] Error going to line/column:', error);
      vscode.window.showErrorMessage(`Error: ${error.message}`);
    });
  }
}

async function openFileAndSelect(fileName) {
  try {
    console.log('[Extension] Starting openFileAndSelect for:', fileName);

    // Use workbench.action.quickOpen with the filename
    console.log('[Extension] Executing workbench.action.quickOpen');
    await vscode.commands.executeCommand(
      'workbench.action.quickOpen',
      fileName
    );

    // Wait a moment for the quick open dialog to populate
    console.log('[Extension] Waiting 100ms for dialog to populate');
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Accept the selected quick open item
    console.log(
      '[Extension] Executing workbench.action.acceptSelectedQuickOpenItem'
    );
    await vscode.commands.executeCommand(
      'workbench.action.acceptSelectedQuickOpenItem'
    );

    console.log('[Extension] openFileAndSelect completed successfully');
  } catch (error) {
    console.error('[Extension] Error in openFileAndSelect:', error);
    vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
  }
}

async function goToLineColumn(line, column) {
  try {
    console.log(
      '[Extension] Starting goToLineColumn for line:',
      line,
      'column:',
      column
    );

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error('No active text editor found');
    }

    // VS Code uses 0-based indexing, but users think in 1-based
    const lineIndex = Math.max(0, line - 1);
    const columnIndex = Math.max(0, column - 1);

    // Create a position and selection
    const position = new vscode.Position(lineIndex, columnIndex);
    const selection = new vscode.Selection(position, position);

    // Set the selection and reveal the position
    editor.selection = selection;
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );

    console.log('[Extension] goToLineColumn completed successfully');
    vscode.window.showInformationMessage(
      `Navigated to line ${line}, column ${column}`
    );
  } catch (error) {
    console.error('[Extension] Error in goToLineColumn:', error);
    vscode.window.showErrorMessage(
      `Failed to go to line/column: ${error.message}`
    );
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

// #region WebviewView Provider Class
class DemoWebviewViewProvider {
  constructor(context) {
    this._context = context;
  }

  resolveWebviewView(webviewViewParam, context, _token) {
    webviewView = webviewViewParam;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this._context.extensionPath, 'media')),
      ],
    };

    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this._context.extensionPath
    );

    webviewView.webview.onDidReceiveMessage((message) => {
      handleWebviewMessage(message);
    });

    webviewView.onDidDispose(() => {
      webviewView = null;
    });
  }
}
// #endregion WebviewView Provider Class

function deactivate() {
  if (panel) {
    panel.dispose();
  }
}

module.exports = {
  activate,
  deactivate,
};
