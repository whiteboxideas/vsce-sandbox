import { useState, useEffect } from 'react';

function App() {
  const [lastMessage, setLastMessage] = useState('No messages yet');

  useEffect(() => {
    // Listen for messages from the extension
    const messageHandler = (event) => {
      const message = event.data;
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
    // Get VS Code API
    const vscode = acquireVsCodeApi();

    // Send message to extension
    vscode.postMessage({
      type: 'notify',
      text: 'Hello from the webview',
    });
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
};

export default App;
