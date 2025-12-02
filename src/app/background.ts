import { Payload, State, MessageType, GraphQLMockerState } from "../type/type";
import Store from "./store";

const stores: Map<number, Store> = new Map();

// Save stores to storage
const saveStoresToStorage = () => {
  const stateToSave = Array.from(stores.values()).map((store) =>
    JSON.stringify(store)
  );
  void chrome.storage.session.set({ state: stateToSave });
};

// Load stores from storage
const loadStoresFromStorage = () => {
  void chrome.storage.session.get("state").then((result) => {
    const stateInfoArray = result.state;
    if (stateInfoArray === undefined) {
      return;
    }
    stateInfoArray.forEach((stateInfo: string) => {
      const state = JSON.parse(stateInfo) as GraphQLMockerState;
      const store = convertStateToStore(state);
      stores.set(store.tabId, store);
    });
  });

  const convertStateToStore = (state: GraphQLMockerState): Store => {
    const store = getStore(state.tabId);
    store.setupFromState(state);
    return store;
  };
};

loadStoresFromStorage();

// Message handling
const ports = new Map<number, Map<string, chrome.runtime.Port | undefined>>();
const NAME_REGEX = /^(popup|content-script|datastore)(\/(\d*))?$/;

const sendMessage = (message: Payload, tabId: number) => {
  if (message === null) {
    return;
  }
  if (message.to === "datastore") {
    const store = getStore(tabId);
    store.updateFrom(message.msg);
    saveStoresToStorage();

    // Send GraphQL custom responses back to content script for appHook
    if (store && message.msg.type === MessageType.GraphQLCustomResponseUpdate) {
      ports
        .get(tabId)
        ?.get("content-script")
        ?.postMessage({
          from: "datastore",
          to: "content-script",
          msg: {
            type: MessageType.Snapshot,
            graphqlCustomResponses: store.graphqlCustomResponses(),
          },
        });
    }
    return;
  }
  const to = message.to;
  const port = ports.get(tabId)?.get(to);
  if (port) {
    port.postMessage(message);
  }
};

chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
  const match = port.name.match(NAME_REGEX);
  if (!match) return;

  const tabId = port?.sender?.tab?.id || parseInt(match[3]);
  if (tabId === undefined) {
    return;
  }
  const name = match[1];

  if (!ports.has(tabId)) {
    const n = new Map<string, chrome.runtime.Port | undefined>();
    ports.set(tabId, n);
  }

  ports.get(tabId)?.set(name, port);
  port.onMessage.addListener((message: Payload) => {
    sendMessage(message, tabId);
  });
  port.onDisconnect.addListener(() => {
    ports.get(tabId)?.delete(name);
  });
});

const getStore = (tabId: number): Store => {
  const existing = stores.get(tabId);
  if (existing !== undefined) {
    return existing;
  }
  const store = new Store(tabId);

  const targets = ["popup", "content-script"];
  targets.forEach((target) => {
    store.registerCallback((tabId: number, state: State) => {
      sendMessage(
        {
          from: "datastore",
          to: target,
          msg: {
            ...state,
            graphqlResponses: state.graphqlResponses,
            graphqlCustomResponses: state.graphqlCustomResponses,
            type: MessageType.Snapshot,
          },
        },
        tabId
      );
    });
  });

  stores.set(tabId, store);
  return store;
};

// Update badge when active mocks exist
const updateBadge = (tabId: number) => {
  const store = stores.get(tabId);
  if (store) {
    const activeMocks = store
      .graphqlCustomResponses()
      .filter((cr) => cr.activated).length;
    void chrome.action.setBadgeText({
      text: activeMocks > 0 ? activeMocks.toString() : "",
      tabId,
    });
    void chrome.action.setBadgeBackgroundColor({
      color: "#6cc644",
      tabId,
    });
  }
};

chrome.tabs.onUpdated.addListener((tabId) => {
  updateBadge(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  stores.delete(tabId);
  ports.delete(tabId);
  saveStoresToStorage();
});
