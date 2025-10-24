const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let panel = null;
let webviewView = null;
let messageCounter = 0;
let notifyCounter = 0;

// Command mapping for VS Code commands
const COMMAND_MAP = {
  // File operations
  'workbench.action.quickOpen': {
    name: 'Quick Open File',
    description: 'Open a file using quick open dialog',
    parameters: ['fileName', 'line', 'column'],
    handler: 'handleQuickOpen',
  },
  'workbench.action.quickOpenPreviousRecentlyUsedEditor': {
    name: 'Open Recent File',
    description: 'Open the most recently used file',
    parameters: [],
    handler: 'handleRecentFile',
  },

  // Navigation
  'workbench.action.gotoLine': {
    name: 'Go to Line',
    description: 'Navigate to a specific line number',
    parameters: ['line'],
    handler: 'handleGoToLine',
  },
  'workbench.action.findInFiles': {
    name: 'Find in Files',
    description: 'Search for text across all files',
    parameters: ['searchTerm'],
    handler: 'handleFindInFiles',
  },

  // UI operations
  'workbench.action.showCommands': {
    name: 'Show Command Palette',
    description: 'Open the command palette',
    parameters: [],
    handler: 'handleShowCommands',
  },

  // Editor operations
  'editor.action.revealDefinition': {
    name: 'Go to Definition',
    description: 'Navigate to the definition of the selected symbol',
    parameters: [],
    handler: 'handleGoToDefinition',
  },
  'editor.action.rename': {
    name: 'Rename Symbol',
    description: 'Rename the selected symbol',
    parameters: ['newName'],
    handler: 'handleRename',
  },

  // View operations
  'workbench.action.toggleSidebarVisibility': {
    name: 'Toggle Sidebar',
    description: 'Show/hide the sidebar',
    parameters: [],
    handler: 'handleToggleSidebar',
  },
  'workbench.action.togglePanel': {
    name: 'Toggle Panel',
    description: 'Show/hide the bottom panel',
    parameters: [],
    handler: 'handleTogglePanel',
  },

  // File operations
  'workbench.action.findFiles': {
    name: 'Find Files by Name',
    description: 'Search for files by name pattern using quick open',
    parameters: ['fileName', 'filePattern'],
    handler: 'handleFindFilesByName',
  },
};

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

  // Register test commands
  const testCommandsCmd = vscode.commands.registerCommand(
    'elk.testCommands',
    () => {
      testAllCommands();
    }
  );

  const testSpecificCmd = vscode.commands.registerCommand(
    'elk.testSpecificCommand',
    (commandId) => {
      testSpecificCommand(commandId);
    }
  );

  const listCommandsCmd = vscode.commands.registerCommand(
    'elk.listCommands',
    () => {
      listAvailableCommands();
    }
  );
  // #endregion Commands (VSCODE -> EXTENSION)

  context.subscriptions.push(
    openPanelCmd,
    sendMessageCmd,
    toggleLocationCmd,
    testCommandsCmd,
    testSpecificCmd,
    listCommandsCmd
  );
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
- "workbench.action.quickOpen" - to OPEN files (use fileName parameter, optional line/column) - automatically selects and opens the file
- "workbench.action.gotoLine" - to go to specific lines (use line parameter)
- "editor.action.revealDefinition" - to go to definitions
- "workbench.action.findInFiles" - to search for text content in files (use searchTerm parameter)
- "workbench.action.findFiles" - to FIND/LIST files by name pattern (use fileName or filePattern parameter) - shows results but doesn't open
- "workbench.action.showCommands" - to show command palette
- "workbench.action.quickOpenPreviousRecentlyUsedEditor" - to open recent files
- "editor.action.rename" - to rename symbols (use newName parameter)
- "workbench.action.toggleSidebarVisibility" - to toggle sidebar
- "workbench.action.togglePanel" - to toggle bottom panel

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
- "open file test.tsx" -> {"command": "workbench.action.quickOpen", "parameters": {"fileName": "test.tsx"}, "description": "Open test.tsx file (automatically selects and opens)"}
- "open package.json" -> {"command": "workbench.action.quickOpen", "parameters": {"fileName": "package.json"}, "description": "Open package.json file"}
- "go to line 25" -> {"command": "workbench.action.gotoLine", "parameters": {"line": 25}, "description": "Go to line 25"}
- "search for function" -> {"command": "workbench.action.findInFiles", "parameters": {"searchTerm": "function"}, "description": "Search for 'function' in files"}
- "find files named test" -> {"command": "workbench.action.findFiles", "parameters": {"fileName": "test"}, "description": "Find files with 'test' in the name (shows list)"}
- "list files with .js extension" -> {"command": "workbench.action.findFiles", "parameters": {"filePattern": "*.js"}, "description": "Find all .js files (shows list)"}
- "rename to newName" -> {"command": "editor.action.rename", "parameters": {"newName": "newName"}, "description": "Rename symbol to newName"}
- "toggle sidebar" -> {"command": "workbench.action.toggleSidebarVisibility", "parameters": {}, "description": "Toggle sidebar visibility"}

IMPORTANT: 
- Use "workbench.action.quickOpen" for "open file" requests - this will open the file
- Use "workbench.action.findFiles" for "find files", "list files", "show files" requests - this will show a list
- Use "workbench.action.findInFiles" for "search for text" requests - this searches content within files
- Always respond with ONLY the JSON object, no other text.`;

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
      structuredResponse.command,
      structuredResponse.parameters
    );

    const commandInfo = COMMAND_MAP[structuredResponse.command];
    if (commandInfo) {
      console.log(`[Extension] Using mapped handler: ${commandInfo.handler}`);
      await executeMappedCommand(structuredResponse, commandInfo);
    } else {
      console.log('[Extension] Using direct command execution');
      // Execute the command directly with any parameters
      const params = structuredResponse.parameters || {};
      console.log('extension.js-552: ', structuredResponse.command, params);
      await vscode.commands.executeCommand(structuredResponse.command, params);
    }

    console.log('[Extension] Structured command executed successfully');
  } catch (error) {
    console.error('[Extension] Error executing structured command:', error);
    throw error;
  }
}

async function executeMappedCommand(structuredResponse, commandInfo) {
  const params = structuredResponse.parameters || {};

  switch (commandInfo.handler) {
    case 'handleQuickOpen':
      console.log('extension.js-569: ', params);
      await handleQuickOpen(params);
      break;
    case 'handleRecentFile':
      await handleRecentFile(params);
      break;
    case 'handleGoToLine':
      await handleGoToLine(params);
      break;
    case 'handleFindInFiles':
      await handleFindInFiles(params);
      break;
    case 'handleShowCommands':
      await handleShowCommands(params);
      break;
    case 'handleGoToDefinition':
      await handleGoToDefinition(params);
      break;
    case 'handleRename':
      await handleRename(params);
      break;
    case 'handleToggleSidebar':
      await handleToggleSidebar(params);
      break;
    case 'handleTogglePanel':
      await handleTogglePanel(params);
      break;
    case 'handleFindFilesByName':
      await handleFindFilesByName(params);
      break;
    default:
      // Fallback to direct execution
      await vscode.commands.executeCommand(structuredResponse.command, params);
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

// Command Handler Functionsx
async function handleQuickOpen(params) {
  const fileName = params?.fileName;
  if (fileName) {
    console.log('extension.js-635: ', fileName);
    // Open quick open
    await vscode.commands.executeCommand(
      'workbench.action.quickOpen',
      fileName
    );
    // Wait for quick open to open
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Wait for search results to populate
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Automatically select the first result
    await vscode.commands.executeCommand(
      'workbench.action.acceptSelectedQuickOpenItem'
    );

    if (params?.line) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await goToLineColumn(params.line, params.column || 1);
    }
  } else {
    // Just open quick open without typing anything
    console.log('extension.js-656: ');
    await vscode.commands.executeCommand('workbench.action.quickOpen');
  }
}

async function handleRecentFile(params) {
  await vscode.commands.executeCommand(
    'workbench.action.quickOpenPreviousRecentlyUsedEditor'
  );
}

async function handleGoToLine(params) {
  const line = params?.line;
  if (line) {
    // Use VS Code's built-in goto line command
    await vscode.commands.executeCommand('workbench.action.gotoLine');
    // Wait for goto line dialog to open
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Type the line number and accept
    await vscode.commands.executeCommand('type', { text: line.toString() });
    await new Promise((resolve) => setTimeout(resolve, 200));
    await vscode.commands.executeCommand(
      'workbench.action.acceptSelectedQuickOpenItem'
    );
  }
}

async function handleFindInFiles(params) {
  const searchTerm = params?.searchTerm;
  if (searchTerm) {
    await vscode.commands.executeCommand('workbench.action.findInFiles');
    // Wait for search panel to open and populate
    await new Promise((resolve) => setTimeout(resolve, 500));
    await vscode.commands.executeCommand('type', { text: searchTerm });
    // Wait for search to complete and accept results
    await new Promise((resolve) => setTimeout(resolve, 300));
    await vscode.commands.executeCommand('search.action.acceptSearchInput');
  } else {
    await vscode.commands.executeCommand('workbench.action.findInFiles');
  }
}

async function handleShowCommands(params) {
  await vscode.commands.executeCommand('workbench.action.showCommands');
  // Wait for command palette to open
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Command palette is now open and ready for user input
}

async function handleGoToDefinition(params) {
  await vscode.commands.executeCommand('editor.action.revealDefinition');
}

async function handleRename(params) {
  const newName = params?.newName;
  await vscode.commands.executeCommand('editor.action.rename');
  // Wait for rename dialog to open
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (newName) {
    // Type the new name
    await vscode.commands.executeCommand('type', { text: newName });
    await new Promise((resolve) => setTimeout(resolve, 200));
    // Accept the rename
    await vscode.commands.executeCommand(
      'workbench.action.acceptSelectedQuickOpenItem'
    );
  }
  // If no newName provided, the rename dialog will be open for manual input
}

async function handleToggleSidebar(params) {
  await vscode.commands.executeCommand(
    'workbench.action.toggleSidebarVisibility'
  );
}

async function handleTogglePanel(params) {
  await vscode.commands.executeCommand('workbench.action.togglePanel');
}

async function handleFindFilesByName(params) {
  const fileName = params?.fileName || params?.filePattern;
  if (fileName) {
    // Use quick open to search for files by name
    await vscode.commands.executeCommand('workbench.action.quickOpen');
    // Wait for quick open to open
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Type the file name pattern (use * for wildcards)
    const searchPattern = fileName.includes('*') ? fileName : `*${fileName}*`;
    await vscode.commands.executeCommand('type', { text: searchPattern });
    // Wait for search results to populate
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Don't auto-accept, let user see the results
    console.log(
      `[Extension] File search completed for pattern: ${searchPattern}`
    );
  } else {
    // Just open quick open for manual file search
    await vscode.commands.executeCommand('workbench.action.quickOpen');
  }
}

// Test Functions
async function testAllCommands() {
  console.log('[Extension] Testing all mapped commands...');

  for (const [commandId, commandInfo] of Object.entries(COMMAND_MAP)) {
    try {
      console.log(
        `[Extension] Testing command: ${commandId} (${commandInfo.name})`
      );

      // Create a test structured response
      const testResponse = {
        command: commandId,
        parameters: createTestParameters(commandId),
        description: commandInfo.description,
      };

      await executeStructuredCommand(testResponse);
      console.log(`[Extension] ✅ Command ${commandId} executed successfully`);

      // Wait between commands to avoid conflicts
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(
        `[Extension] ❌ Command ${commandId} failed:`,
        error.message
      );
    }
  }

  vscode.window.showInformationMessage(
    'Command testing completed! Check the console for results.'
  );
}

async function testSpecificCommand(commandId) {
  console.log(`[Extension] Testing specific command: ${commandId}`);

  const commandInfo = COMMAND_MAP[commandId];
  if (!commandInfo) {
    vscode.window.showErrorMessage(
      `Command ${commandId} not found in command map`
    );
    return;
  }

  try {
    const testResponse = {
      command: commandId,
      parameters: createTestParameters(commandId),
      description: commandInfo.description,
    };

    await executeStructuredCommand(testResponse);
    vscode.window.showInformationMessage(
      `✅ Command ${commandId} executed successfully`
    );
  } catch (error) {
    console.error(`[Extension] ❌ Command ${commandId} failed:`, error.message);
    vscode.window.showErrorMessage(
      `Command ${commandId} failed: ${error.message}`
    );
  }
}

function createTestParameters(commandId) {
  const testParams = {
    'workbench.action.quickOpen': { fileName: 'package.json' },
    'workbench.action.gotoLine': { line: 1 },
    'workbench.action.findInFiles': { searchTerm: 'function' },
    'workbench.action.findFiles': { fileName: 'test' },
    'editor.action.rename': { newName: 'testName' },
  };

  return testParams[commandId] || {};
}

function listAvailableCommands() {
  console.log('[Extension] Available Commands:');
  console.log('================================');

  for (const [commandId, commandInfo] of Object.entries(COMMAND_MAP)) {
    console.log(`\n${commandId}:`);
    console.log(`  Name: ${commandInfo.name}`);
    console.log(`  Description: ${commandInfo.description}`);
    console.log(`  Parameters: ${commandInfo.parameters.join(', ') || 'None'}`);
    console.log(`  Handler: ${commandInfo.handler}`);
  }

  // Show in VS Code as well
  const commandList = Object.entries(COMMAND_MAP)
    .map(([id, info]) => `${id}: ${info.name} - ${info.description}`)
    .join('\n');

  vscode.window
    .showInformationMessage(
      `Available Commands (${
        Object.keys(COMMAND_MAP).length
      } total):\n${commandList}`,
      'Test All Commands',
      'Show in Console'
    )
    .then((selection) => {
      if (selection === 'Test All Commands') {
        testAllCommands();
      } else if (selection === 'Show in Console') {
        // Commands are already logged to console
      }
    });
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
