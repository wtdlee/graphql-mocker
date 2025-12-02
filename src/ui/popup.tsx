import { createRoot } from 'react-dom/client';
import App from './app';

// Add editor-mode class if in editor window
if (window.location.hash === '#graphql-editor') {
  document.body.classList.add('editor-mode');
}

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const tabId = tabs[0]?.id;
  if (tabId === undefined) {
    return;
  }

  const container = document.getElementById('root');
  if (!container) {
    return;
  }

  const root = createRoot(container);
  root.render(<App tabId={tabId} />);
});
