import { MessageType } from "../type/type";

let port = chrome.runtime.connect({ name: "content-script" });

port.onDisconnect.addListener(() => {
  port = undefined as any;
});

// Webpage to port (from appHook.js)
window.addEventListener("message", (event: any) => {
  if (event.data && event.data.source === "graphql-mocker-web-page") {
    if (port) {
      port.postMessage(event.data.data);
    }
  }
});

// Handle messages from devtools/popup
function handleMessageFromDevtools(message: any) {
  window.postMessage(
    {
      source: "graphql-mocker-content-script",
      message,
      type: "pass-through-to-app",
    },
    "*"
  );
}

port.onMessage.addListener(handleMessageFromDevtools);

// Reconnect if needed when storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "session") {
    return;
  }

  if (port === undefined) {
    port = chrome.runtime.connect({ name: "content-script" });
    port.onMessage.addListener(handleMessageFromDevtools);
  }

  // Request data from background
  port.postMessage({
    from: "content-script",
    to: "datastore",
    msg: { type: MessageType.SnapshotRequest },
  });
});

// Inject appHook.js to web page context
function injectAppHook() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("js/appHook.js");
  (document.head || document.documentElement).appendChild(script);
}

// Inject as early as possible
if (document.documentElement) {
  injectAppHook();
} else {
  // Wait for DOM to be ready
  document.addEventListener("DOMContentLoaded", injectAppHook);
}
