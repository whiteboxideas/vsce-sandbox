const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let panel = null;
let webviewView = null;
let messageCounter = 0;
let notifyCounter = 0;

function activate(context) {
  // #region WebviewView Provider (for bottom panel)
  const provider = new DemoWebviewViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('elk.bottomPanel', provider)
  );
  // #endregion WebviewView Provider

  // #region Commands (VSCODE -> EXTENSION)
  // Register openPanel command
  const openPanelCmd = vscode.commands.registerCommand('elk.openPanel', () => {
    openPanel(context);
  });

  // Register sendMessage command
  const sendMessageCmd = vscode.commands.registerCommand(
    'elk.sendMessage',
    () => {
      sendMessage(context);
    }
  );

  // Register togglePanelLocation command
  const toggleLocationCmd = vscode.commands.registerCommand(
    'elk.togglePanelLocation',
    () => {
      togglePanelLocation(context);
    }
  );
  // #endregion Commands (VSCODE -> EXTENSION)

  context.subscriptions.push(openPanelCmd, sendMessageCmd, toggleLocationCmd);
}

function openPanel(context) {
  const config = vscode.workspace.getConfiguration('elk');
  const panelLocation = config.get('panelLocation', 'tab');

  if (panelLocation === 'bottom') {
    // Open the bottom panel view
    vscode.commands.executeCommand('elk.bottomPanel.focus');
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
      handleWebviewMessage(message, context);
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
  const config = vscode.workspace.getConfiguration('elk');
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

function togglePanelLocation(context) {
  const config = vscode.workspace.getConfiguration('elk');
  const currentLocation = config.get('panelLocation', 'tab');
  const newLocation = currentLocation === 'tab' ? 'bottom' : 'tab';

  // Update the configuration
  config.update(
    'panelLocation',
    newLocation,
    vscode.ConfigurationTarget.Global
  );

  // Close current panel
  if (panel) {
    panel.dispose();
    panel = null;
  }
  if (webviewView) {
    // Can't programmatically close webviewView, but it will be replaced
    webviewView = null;
  }

  // Open in new location after a brief delay
  setTimeout(() => {
    openPanel(context);
    vscode.window.showInformationMessage(
      `Panel moved to ${newLocation === 'tab' ? 'editor tab' : 'bottom panel'}`
    );
  }, 100);
}

function handleWebviewMessage(message, context) {
  console.log('[Extension] Received message from webview:', message);

  if (message.type === 'notify') {
    //  Extension -> VSCODE
    notifyCounter++;
    const timestamp = new Date().toLocaleTimeString();
    const notificationText = `${message.text} - #${notifyCounter} at ${timestamp}`;
    console.log('[Extension] Showing notification:', notificationText);
    vscode.window.showInformationMessage(notificationText);
  } else if (message.type === 'toggleLocation') {
    togglePanelLocation(context);
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
  } else if (message.type === 'llmRequest') {
    // Handle LLM request
    console.log('[Extension] LLM request received:', message.message);
    handleLlmRequest(message.message, message.url, context).catch((error) => {
      console.error('[Extension] Error handling LLM request:', error);
      sendLlmError(error.message);
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

async function handleLlmRequest(message, url, context) {
  try {
    console.log('[Extension] Starting LLM request to:', url);

    // Create the structured prompt for the LLM
    const systemPrompt = `You are a VS Code assistant. When given a user request, respond with a JSON object containing the appropriate VS Code command and parameters.

Available commands:
- "workbench.action.quickOpen" - to open files (use fileName parameter)
- "workbench.action.gotoLine" - to go to specific lines (use line parameter)
- "editor.action.revealDefinition" - to go to definitions
- "workbench.action.findInFiles" - to search in files (use searchTerm parameter)
- "workbench.action.showCommands" - to show command palette
- "workbench.action.quickOpenPreviousRecentlyUsedEditor" - to open recent files

Response format (ALWAYS respond with valid JSON only):
{
  "command": "workbench.action.quickOpen",
  "parameters": {
    "fileName": "example.tsx",
    "line": 10,
    "column": 5
  },
  "description": "Brief description of what this command does"
}

Examples:
- "open file test.tsx" -> {"command": "workbench.action.quickOpen", "parameters": {"fileName": "test.tsx"}, "description": "Open test.tsx file"}
- "go to line 25" -> {"command": "workbench.action.gotoLine", "parameters": {"line": 25}, "description": "Go to line 25"}
- "search for function" -> {"command": "workbench.action.findInFiles", "parameters": {"searchTerm": "function"}, "description": "Search for 'function' in files"}

IMPORTANT: Always respond with ONLY the JSON object, no other text.`;

    const requestBody = {
      model: 'local-model',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    };

    const response = await makeLlmRequest(url, requestBody);
    console.log('[Extension] LLM response received:', response);

    // Parse the structured response
    const structuredResponse = parseLlmResponse(response);
    console.log('[Extension] Parsed structured response:', structuredResponse);

    // Execute the VS Code command
    await executeStructuredCommand(structuredResponse);

    // Send response back to webview
    sendLlmResponse(JSON.stringify(structuredResponse, null, 2));
  } catch (error) {
    console.error('[Extension] Error in handleLlmRequest:', error);
    throw error;
  }
}

async function makeLlmRequest(url, requestBody) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(requestBody)),
      },
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (
            response.choices &&
            response.choices[0] &&
            response.choices[0].message
          ) {
            resolve(response.choices[0].message.content);
          } else {
            reject(new Error('Invalid LLM response format'));
          }
        } catch (parseError) {
          reject(
            new Error(`Failed to parse LLM response: ${parseError.message}`)
          );
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`LLM request failed: ${error.message}`));
    });

    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

function parseLlmResponse(response) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in LLM response');
    }
  } catch (error) {
    // If parsing fails, return a default structure
    return {
      command: 'workbench.action.quickOpen',
      parameters: {
        fileName: 'unknown',
      },
      description: 'Could not parse LLM response',
      rawResponse: response,
    };
  }
}

async function executeStructuredCommand(structuredResponse) {
  try {
    console.log(
      '[Extension] Executing structured command:',
      structuredResponse.command
    );

    if (structuredResponse.command === 'workbench.action.quickOpen') {
      const fileName = structuredResponse.parameters?.fileName;
      if (fileName) {
        await vscode.commands.executeCommand(
          'workbench.action.quickOpen',
          fileName
        );
        // Wait for quick open to populate
        await new Promise((resolve) => setTimeout(resolve, 100));
        await vscode.commands.executeCommand(
          'workbench.action.acceptSelectedQuickOpenItem'
        );

        // If line/column specified, navigate there
        if (structuredResponse.parameters?.line) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          await goToLineColumn(
            structuredResponse.parameters.line,
            structuredResponse.parameters.column || 1
          );
        }
      }
    } else if (structuredResponse.command === 'workbench.action.gotoLine') {
      const line = structuredResponse.parameters?.line;
      if (line) {
        // Use our existing goToLineColumn function for better control
        await goToLineColumn(line, 1);
      }
    } else if (structuredResponse.command === 'workbench.action.findInFiles') {
      const searchTerm = structuredResponse.parameters?.searchTerm;
      if (searchTerm) {
        await vscode.commands.executeCommand('workbench.action.findInFiles');
        // Wait for search to open, then set the search term
        await new Promise((resolve) => setTimeout(resolve, 100));
        // The search input should be focused, we can type the search term
        await vscode.commands.executeCommand('type', { text: searchTerm });
      }
    } else if (structuredResponse.command === 'workbench.action.showCommands') {
      await vscode.commands.executeCommand('workbench.action.showCommands');
    } else if (
      structuredResponse.command ===
      'workbench.action.quickOpenPreviousRecentlyUsedEditor'
    ) {
      await vscode.commands.executeCommand(
        'workbench.action.quickOpenPreviousRecentlyUsedEditor'
      );
    } else {
      // Execute the command directly with any parameters
      const params = structuredResponse.parameters || {};
      await vscode.commands.executeCommand(structuredResponse.command, params);
    }

    console.log('[Extension] Structured command executed successfully');
  } catch (error) {
    console.error('[Extension] Error executing structured command:', error);
    throw error;
  }
}

function sendLlmResponse(response) {
  const message = {
    type: 'llmResponse',
    response: response,
  };

  if (panel) {
    panel.webview.postMessage(message);
  } else if (webviewView) {
    webviewView.webview.postMessage(message);
  }
}

function sendLlmError(error) {
  const message = {
    type: 'llmError',
    error: error,
  };

  if (panel) {
    panel.webview.postMessage(message);
  } else if (webviewView) {
    webviewView.webview.postMessage(message);
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
      handleWebviewMessage(message, this._context);
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
