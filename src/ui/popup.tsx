import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./app";

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tabId = tabs[0].id;
  if (tabId === undefined) {
    return;
  }
  ReactDOM.render(<App tabId={tabId} />, document.getElementById("root"));
});
