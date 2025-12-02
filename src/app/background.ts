import {
  Payload,
  State,
  MessageType,
  GraphQLMockerState,
  MockerSettings,
  DEFAULT_SETTINGS,
} from '../type/type';
import Store from './store';

const stores: Map<number, Store> = new Map();
let globalSettings: MockerSettings = { ...DEFAULT_SETTINGS };

// Save stores to session storage (temporary data)
const saveStoresToStorage = () => {
  const stateToSave = Array.from(stores.values()).map(store => JSON.stringify(store));
  void chrome.storage.session.set({ state: stateToSave });
};

// Save settings to local storage (permanent)
const saveSettingsToStorage = () => {
  void chrome.storage.local.set({ settings: globalSettings });
};

// Load settings from local storage
const loadSettingsFromStorage = async (): Promise<MockerSettings> => {
  const result = await chrome.storage.local.get('settings');
  if (result.settings) {
    globalSettings = result.settings as MockerSettings;
  }
  return globalSettings;
};

// Load stores from session storage
const loadStoresFromStorage = async () => {
  // First load global settings
  await loadSettingsFromStorage();

  // Then load session state
  const result = await chrome.storage.session.get('state');
  const stateInfoArray = result.state as string[] | undefined;
  if (stateInfoArray === undefined) {
    return;
  }
  stateInfoArray.forEach((stateInfo: string) => {
    const state = JSON.parse(stateInfo) as GraphQLMockerState;
    // Override settings with global settings
    state.settings = globalSettings;
    const store = convertStateToStore(state);
    stores.set(store.tabId, store);
  });

  function convertStateToStore(state: GraphQLMockerState): Store {
    const store = getStore(state.tabId);
    store.setupFromState(state);
    return store;
  }
};

void loadStoresFromStorage();

// Message handling
const ports = new Map<number, Map<string, chrome.runtime.Port | undefined>>();
const NAME_REGEX = /^(popup|content-script|datastore)(\/(\d*))?$/;

const sendMessage = (message: Payload, tabId: number) => {
  if (message === null) {
    return;
  }

  // Handle keep-alive ping - just receiving it keeps the service worker alive
  if (message.msg?.type === MessageType.Ping) {
    return;
  }

  if (message.to === 'datastore') {
    const store = getStore(tabId);

    // Handle settings update globally
    if (message.msg.type === MessageType.SettingsUpdate && message.msg.settings) {
      globalSettings = message.msg.settings;
      saveSettingsToStorage();

      // Update settings for all stores
      stores.forEach(s => {
        s.setSettings(globalSettings);
      });
    }

    store.updateFrom(message.msg);
    saveStoresToStorage();

    // Send updates back to content script for appHook
    if (
      store &&
      (message.msg.type === MessageType.GraphQLCustomResponseUpdate ||
        message.msg.type === MessageType.SettingsUpdate)
    ) {
      ports
        .get(tabId)
        ?.get('content-script')
        ?.postMessage({
          from: 'datastore',
          to: 'content-script',
          msg: {
            type: MessageType.Snapshot,
            graphqlCustomResponses: store.graphqlCustomResponses(),
            settings: globalSettings,
          },
        });
    }

    // Update badge for all tabs when settings change
    if (message.msg.type === MessageType.SettingsUpdate) {
      stores.forEach((_, tid) => updateBadge(tid));
    } else {
      updateBadge(tabId);
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
  if (tabId === undefined || isNaN(tabId)) {
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

  // Initialize with global settings
  store.setSettings(globalSettings);

  const targets = ['popup', 'content-script'];
  targets.forEach(target => {
    store.registerCallback((tabId: number, state: State) => {
      sendMessage(
        {
          from: 'datastore',
          to: target,
          msg: {
            ...state,
            graphqlResponses: state.graphqlResponses,
            graphqlCustomResponses: state.graphqlCustomResponses,
            settings: globalSettings, // Always use global settings
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
    const settings = store.getSettings();
    const activeMocks = store.graphqlCustomResponses().filter(cr => cr.activated).length;
    const isGlobalEnabled = settings.globalMockEnabled;

    if (activeMocks > 0 && isGlobalEnabled) {
      void chrome.action.setBadgeText({
        text: activeMocks.toString(),
        tabId,
      });
      void chrome.action.setBadgeBackgroundColor({
        color: '#10b981', // emerald-500
        tabId,
      });
    } else if (activeMocks > 0 && !isGlobalEnabled) {
      void chrome.action.setBadgeText({
        text: '⏸',
        tabId,
      });
      void chrome.action.setBadgeBackgroundColor({
        color: '#64748b', // slate-500
        tabId,
      });
    } else {
      void chrome.action.setBadgeText({
        text: '',
        tabId,
      });
    }
  }
};

chrome.tabs.onUpdated.addListener(tabId => {
  updateBadge(tabId);
});

chrome.tabs.onRemoved.addListener(tabId => {
  stores.delete(tabId);
  ports.delete(tabId);
  saveStoresToStorage();
});
