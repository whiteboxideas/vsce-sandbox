import { useState, useEffect } from 'react';

// Acquire VS Code API once at module level
const vscode = acquireVsCodeApi();

function App() {
  const [lastMessage, setLastMessage] = useState('No messages yet');
  const [fileName, setFileName] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [columnNumber, setColumnNumber] = useState('');
  const [llmUrl, setLlmUrl] = useState('http://localhost:1234');
  const [llmMessage, setLlmMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [llmResponse, setLlmResponse] = useState('');

  useEffect(() => {
    console.log('[Webview] App mounted, vscode API:', vscode);

    // Listen for messages from the extension
    const messageHandler = (event) => {
      const message = event.data;
      console.log('[Webview] Received message from extension:', message);
      if (message.type === 'hostMessage') {
        setLastMessage(message.text);
      } else if (message.type === 'llmResponse') {
        setLlmResponse(message.response);
        setIsLoading(false);
      } else if (message.type === 'llmError') {
        setLlmResponse(`Error: ${message.error}`);
        setIsLoading(false);
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  const handleNotifyClick = () => {
    console.log('[Webview] Notify button clicked');

    // Send message to extension
    vscode.postMessage({
      type: 'notify',
      text: 'Hello from the webview',
    });

    console.log('[Webview] Notify message sent');
  };

  const handleToggleLocation = () => {
    console.log('[Webview] Toggle location button clicked');

    // Send message to extension to toggle panel location
    vscode.postMessage({
      type: 'toggleLocation',
    });

    console.log('[Webview] Toggle location message sent');
  };

  const handleOpenFile = () => {
    console.log('[Webview] Open file button clicked, fileName:', fileName);

    if (!fileName.trim()) {
      console.log('[Webview] File name is empty, aborting');
      return;
    }

    // Send message to extension to open file and select
    vscode.postMessage({
      type: 'openFile',
      fileName: fileName.trim(),
    });

    console.log('[Webview] Open file message sent');
  };

  const handleGoToLineColumn = () => {
    console.log(
      '[Webview] Go to line/column button clicked, line:',
      lineNumber,
      'column:',
      columnNumber
    );

    if (!lineNumber.trim()) {
      console.log('[Webview] Line number is empty, aborting');
      return;
    }

    // Send message to extension to go to line and column
    vscode.postMessage({
      type: 'goToLineColumn',
      line: parseInt(lineNumber.trim(), 10),
      column: columnNumber.trim() ? parseInt(columnNumber.trim(), 10) : 1,
    });

    console.log('[Webview] Go to line/column message sent');
  };

  const handleLlmSend = () => {
    console.log('[Webview] LLM send button clicked, message:', llmMessage);

    if (!llmMessage.trim()) {
      console.log('[Webview] LLM message is empty, aborting');
      return;
    }

    if (!llmUrl.trim()) {
      console.log('[Webview] LLM URL is empty, aborting');
      return;
    }

    setIsLoading(true);
    setLlmResponse('');

    // Send message to extension to call LLM
    vscode.postMessage({
      type: 'llmRequest',
      message: llmMessage.trim(),
      url: llmUrl.trim(),
    });

    console.log('[Webview] LLM request message sent');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Webview Demo</h1>

      <div style={styles.messageBox}>
        <h2 style={styles.subheading}>Last Message from VS Code:</h2>
        <div id='log' style={styles.log}>
          {lastMessage}
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button
          onClick={handleNotifyClick}
          style={styles.button}
          onMouseOver={(e) =>
            (e.target.style.backgroundColor =
              styles.buttonHover.backgroundColor)
          }
          onMouseOut={(e) =>
            (e.target.style.backgroundColor = styles.button.backgroundColor)
          }
        >
          Notify in VS Code
        </button>

        <button
          onClick={handleToggleLocation}
          style={styles.secondaryButton}
          onMouseOver={(e) =>
            (e.target.style.backgroundColor =
              styles.secondaryButtonHover.backgroundColor)
          }
          onMouseOut={(e) =>
            (e.target.style.backgroundColor =
              styles.secondaryButton.backgroundColor)
          }
        >
          Toggle Panel Location
        </button>
      </div>

      <div style={styles.fileSection}>
        <h2 style={styles.subheading}>Open File and Select:</h2>
        <div style={styles.inputGroup}>
          <input
            type='text'
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder='Enter file name or path'
            style={styles.input}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleOpenFile();
              }
            }}
          />
          <button
            onClick={handleOpenFile}
            style={styles.button}
            onMouseOver={(e) =>
              (e.target.style.backgroundColor =
                styles.buttonHover.backgroundColor)
            }
            onMouseOut={(e) =>
              (e.target.style.backgroundColor = styles.button.backgroundColor)
            }
          >
            Open & Select
          </button>
        </div>
      </div>

      <div style={styles.fileSection}>
        <h2 style={styles.subheading}>Go to Line and Column:</h2>
        <div style={styles.inputGroup}>
          <input
            type='text'
            value={lineNumber}
            onChange={(e) => setLineNumber(e.target.value)}
            placeholder='Line number'
            style={{ ...styles.input, flex: 0.5 }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleGoToLineColumn();
              }
            }}
          />
          <input
            type='text'
            value={columnNumber}
            onChange={(e) => setColumnNumber(e.target.value)}
            placeholder='Column (optional)'
            style={{ ...styles.input, flex: 0.5 }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleGoToLineColumn();
              }
            }}
          />
          <button
            onClick={handleGoToLineColumn}
            style={styles.button}
            onMouseOver={(e) =>
              (e.target.style.backgroundColor =
                styles.buttonHover.backgroundColor)
            }
            onMouseOut={(e) =>
              (e.target.style.backgroundColor = styles.button.backgroundColor)
            }
          >
            Go to Line
          </button>
        </div>
      </div>

      <div style={styles.fileSection}>
        <h2 style={styles.subheading}>LLM Assistant:</h2>
        <div style={styles.llmSection}>
          <div style={styles.inputGroup}>
            <input
              type='text'
              value={llmUrl}
              onChange={(e) => setLlmUrl(e.target.value)}
              placeholder='LLM URL (e.g., http://localhost:1234)'
              style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <textarea
              value={llmMessage}
              onChange={(e) => setLlmMessage(e.target.value)}
              placeholder='Enter your message to the LLM (e.g., "open file test.tsx")'
              style={{ ...styles.input, ...styles.textarea }}
              rows={3}
            />
            <button
              onClick={handleLlmSend}
              disabled={isLoading}
              style={{
                ...styles.button,
                ...(isLoading ? styles.buttonDisabled : {}),
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.target.style.backgroundColor =
                    styles.buttonHover.backgroundColor;
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading) {
                  e.target.style.backgroundColor =
                    styles.button.backgroundColor;
                }
              }}
            >
              {isLoading ? 'Sending...' : 'Send to LLM'}
            </button>
          </div>
          {llmResponse && (
            <div style={styles.responseBox}>
              <h3 style={styles.subheading}>LLM Response:</h3>
              <div style={styles.log}>{llmResponse}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'var(--vscode-font-family)',
    color: 'var(--vscode-foreground)',
    backgroundColor: 'var(--vscode-editor-background)',
    minHeight: '100vh',
  },
  heading: {
    fontSize: '24px',
    marginBottom: '20px',
    color: 'var(--vscode-foreground)',
  },
  subheading: {
    fontSize: '16px',
    marginBottom: '10px',
    color: 'var(--vscode-descriptionForeground)',
  },
  messageBox: {
    marginBottom: '20px',
  },
  log: {
    padding: '15px',
    backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
    border: '1px solid var(--vscode-panel-border)',
    borderRadius: '4px',
    fontFamily: 'var(--vscode-editor-font-family)',
    fontSize: '14px',
    minHeight: '60px',
    display: 'flex',
    alignItems: 'center',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '20px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    color: 'var(--vscode-button-foreground)',
    backgroundColor: 'var(--vscode-button-background)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontFamily: 'var(--vscode-font-family)',
  },
  buttonHover: {
    backgroundColor: 'var(--vscode-button-hoverBackground)',
  },
  secondaryButton: {
    padding: '10px 20px',
    fontSize: '14px',
    color: 'var(--vscode-button-secondaryForeground)',
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontFamily: 'var(--vscode-font-family)',
  },
  secondaryButtonHover: {
    backgroundColor: 'var(--vscode-button-secondaryHoverBackground)',
  },
  fileSection: {
    marginTop: '30px',
  },
  inputGroup: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    fontFamily: 'var(--vscode-font-family)',
    color: 'var(--vscode-input-foreground)',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
  },
  textarea: {
    resize: 'vertical',
    minHeight: '60px',
  },
  llmSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  responseBox: {
    marginTop: '15px',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};

export default App;
