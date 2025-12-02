import { createRoot } from 'react-dom/client';
import App from './app';

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
