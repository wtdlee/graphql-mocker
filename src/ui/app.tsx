import { useEffect, useState, useCallback, useRef } from 'react';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';
import GraphQLList from './components/GraphQLList';
import { GraphQLEditorWindow } from './components/GraphQLEditorWindow';
import {
  MessageType,
  GraphQLResponse,
  GraphQLCustomResponse,
  MockerSettings,
  State,
  Payload,
  DEFAULT_SETTINGS,
  JsonValue,
} from '../type/type';
import { darkTheme, lightTheme } from './lib/colors';

// Global styles for scrollbar theming
const GlobalStyle = createGlobalStyle`
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: ${props => props.theme.bg.secondary};
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb {
    background: ${props => props.theme.border.secondary};
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: ${props => props.theme.text.muted};
  }
  
  body {
    background: ${props => props.theme.bg.primary};
  }
`;

interface AppProps {
  tabId: number;
}

// Safe postMessage wrapper
const safePostMessage = (port: chrome.runtime.Port | null, message: Payload): boolean => {
  if (!port) return false;
  try {
    port.postMessage(message);
    return true;
  } catch (error) {
    // Port is disconnected
    console.warn('Port disconnected, message not sent:', error);
    return false;
  }
};

// Keep-alive interval (20 seconds - service worker sleeps at 30s)
const KEEP_ALIVE_INTERVAL = 20000;
// Reconnect delay on disconnect
const RECONNECT_DELAY = 1000;
// Max reconnect attempts
const MAX_RECONNECT_ATTEMPTS = 5;

const App: React.FC<AppProps> = ({ tabId }) => {
  const [isGraphQLEditor, setIsGraphQLEditor] = useState(false);
  const [graphqlResponses, setGraphqlResponses] = useState<GraphQLResponse[]>([]);
  const [graphqlCustomResponses, setGraphqlCustomResponses] = useState<GraphQLCustomResponse[]>([]);
  const [settings, setSettings] = useState<MockerSettings>(DEFAULT_SETTINGS);
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);
  const isConnectedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = settings.darkMode ? darkTheme : lightTheme;

  useEffect(() => {
    // Check if we're in the GraphQL editor mode
    const hash = window.location.hash;
    setIsGraphQLEditor(hash === '#graphql-editor');

    const handleHashChange = () => {
      setIsGraphQLEditor(window.location.hash === '#graphql-editor');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Connect to background service worker
  const connectPort = useCallback(() => {
    if (isGraphQLEditor) return null;

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      const newPort = chrome.runtime.connect({ name: `popup/${tabId}` });
      isConnectedRef.current = true;
      reconnectAttemptsRef.current = 0; // Reset on successful connection

      const handleMessage = (message: Payload) => {
        if (message.msg?.type === MessageType.Snapshot) {
          const state = message.msg as State;
          setGraphqlResponses(state.graphqlResponses || []);
          setGraphqlCustomResponses(state.graphqlCustomResponses || []);
          setSettings(state.settings || DEFAULT_SETTINGS);
        }
      };

      const handleDisconnect = () => {
        isConnectedRef.current = false;
        setPort(null);

        // Clear keep-alive interval
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
          keepAliveIntervalRef.current = null;
        }

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          console.log(
            `Port disconnected. Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            const reconnectedPort = connectPort();
            if (reconnectedPort) {
              setPort(reconnectedPort);
            }
          }, RECONNECT_DELAY);
        } else {
          console.warn('Max reconnect attempts reached. Please refresh the page.');
        }
      };

      newPort.onMessage.addListener(handleMessage);
      newPort.onDisconnect.addListener(handleDisconnect);

      // Request initial state
      safePostMessage(newPort, {
        from: 'popup',
        to: 'datastore',
        msg: { type: MessageType.SnapshotRequest },
      });

      return newPort;
    } catch (error) {
      console.error('Failed to connect port:', error);
      return null;
    }
  }, [tabId, isGraphQLEditor]);

  // Set up port connection
  useEffect(() => {
    if (isGraphQLEditor) return;

    const newPort = connectPort();
    if (newPort) {
      setPort(newPort);
    }

    return () => {
      isConnectedRef.current = false;
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connectPort, isGraphQLEditor]);

  // Keep-alive ping to prevent service worker from sleeping
  useEffect(() => {
    if (isGraphQLEditor || !port) return;

    // Send keep-alive ping every 20 seconds
    keepAliveIntervalRef.current = setInterval(() => {
      if (isConnectedRef.current && port) {
        safePostMessage(port, {
          from: 'popup',
          to: 'datastore',
          msg: { type: MessageType.Ping },
        });
      }
    }, KEEP_ALIVE_INTERVAL);

    return () => {
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }
    };
  }, [port, isGraphQLEditor]);

  // Listen for broadcast channel messages from editor window
  useEffect(() => {
    if (isGraphQLEditor) return;

    interface EditorSaveMessage {
      type: string;
      operationName: string;
      customResponse: JsonValue;
      activated: boolean;
      delay: number;
    }

    const channel = new BroadcastChannel('graphql-editor');
    channel.onmessage = (event: MessageEvent<EditorSaveMessage>) => {
      const data = event.data;
      if (data.type === 'save' && port && isConnectedRef.current) {
        const { operationName, customResponse, activated, delay } = data;
        const allCustomResponses = [...graphqlCustomResponses];
        const existingIndex = allCustomResponses.findIndex(
          cr => cr.operationName === operationName
        );

        const newCustomResponse: GraphQLCustomResponse = {
          operationName,
          customResponse,
          activated,
          delay,
        };

        if (existingIndex >= 0) {
          allCustomResponses[existingIndex] = newCustomResponse;
        } else {
          allCustomResponses.push(newCustomResponse);
        }

        safePostMessage(port, {
          from: 'popup',
          to: 'datastore',
          msg: {
            type: MessageType.GraphQLCustomResponseUpdate,
            graphqlCustomResponses: allCustomResponses,
          },
        });
      }
    };

    return () => {
      channel.close();
    };
  }, [port, graphqlCustomResponses, isGraphQLEditor]);

  const updateCustomResponse = useCallback(
    (customResponse: GraphQLCustomResponse) => {
      if (!port || !isConnectedRef.current) return;

      let updatedResponses: GraphQLCustomResponse[];

      if (customResponse.customResponse === null) {
        // Delete the custom response
        updatedResponses = graphqlCustomResponses.filter(
          cr => cr.operationName !== customResponse.operationName
        );
      } else {
        // Add or update the custom response
        const existingIndex = graphqlCustomResponses.findIndex(
          cr => cr.operationName === customResponse.operationName
        );

        if (existingIndex >= 0) {
          updatedResponses = [...graphqlCustomResponses];
          updatedResponses[existingIndex] = customResponse;
        } else {
          updatedResponses = [...graphqlCustomResponses, customResponse];
        }
      }

      safePostMessage(port, {
        from: 'popup',
        to: 'datastore',
        msg: {
          type: MessageType.GraphQLCustomResponseUpdate,
          graphqlCustomResponses: updatedResponses,
        },
      });
    },
    [port, graphqlCustomResponses]
  );

  const updateSettings = useCallback(
    (newSettings: MockerSettings) => {
      if (!port || !isConnectedRef.current) return;

      const success = safePostMessage(port, {
        from: 'popup',
        to: 'datastore',
        msg: {
          type: MessageType.SettingsUpdate,
          settings: newSettings,
        },
      });

      if (success) {
        setSettings(newSettings);
      }
    },
    [port]
  );

  const handleClearAll = useCallback(() => {
    if (!port || !isConnectedRef.current) return;

    if (confirm('Are you sure you want to clear all captured responses?')) {
      safePostMessage(port, {
        from: 'popup',
        to: 'datastore',
        msg: {
          type: MessageType.ClearAll,
        },
      });
    }
  }, [port]);

  if (isGraphQLEditor) {
    return <GraphQLEditorWindow />;
  }

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Container>
        <GraphQLList
          graphqlResponses={graphqlResponses}
          graphqlCustomResponses={graphqlCustomResponses}
          settings={settings}
          updateCustomResponse={updateCustomResponse}
          updateSettings={updateSettings}
          onClearAll={handleClearAll}
        />
      </Container>
    </ThemeProvider>
  );
};

const Container = styled.div`
  width: 100%;
  height: 100%;
  background: ${props => props.theme.bg.primary};
`;

export default App;
