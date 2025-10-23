import { useState, useEffect } from 'react';

// Acquire VS Code API once at module level
const vscode = acquireVsCodeApi();

function App() {
  const [lastMessage, setLastMessage] = useState('No messages yet');
  const [fileName, setFileName] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [columnNumber, setColumnNumber] = useState('');

  useEffect(() => {
    console.log('[Webview] App mounted, vscode API:', vscode);

    // Listen for messages from the extension
    const messageHandler = (event) => {
      const message = event.data;
      console.log('[Webview] Received message from extension:', message);
      if (message.type === 'hostMessage') {
        setLastMessage(message.text);
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

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Webview Demo</h1>

      <div style={styles.messageBox}>
        <h2 style={styles.subheading}>Last Message from VS Code:</h2>
        <div id='log' style={styles.log}>
          {lastMessage}
        </div>
      </div>

      <button
        onClick={handleNotifyClick}
        style={styles.button}
        onMouseOver={(e) =>
          (e.target.style.backgroundColor = styles.buttonHover.backgroundColor)
        }
        onMouseOut={(e) =>
          (e.target.style.backgroundColor = styles.button.backgroundColor)
        }
      >
        Notify in VS Code
      </button>

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
};

export default App;
