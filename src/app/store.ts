import {
  State,
  Message,
  MessageType,
  GraphQLMockerState,
  GraphQLResponse,
  GraphQLCustomResponse,
  MockerSettings,
  DEFAULT_SETTINGS,
} from '../type/type';

type Callback = (tabId: number, state: State) => void;

class Store {
  private graphqlResponsesMap: Map<string, GraphQLResponse[]>;
  private graphqlCustomResponsesMap: Map<string, GraphQLCustomResponse>;
  private settings: MockerSettings;
  public tabId: number;
  private callbacks: Callback[] = [];

  constructor(tabId: number) {
    this.graphqlResponsesMap = new Map();
    this.graphqlCustomResponsesMap = new Map();
    this.settings = DEFAULT_SETTINGS;
    this.tabId = tabId;
  }

  public dump = (): State => {
    return {
      graphqlResponses: this.graphqlResponses(),
      graphqlCustomResponses: this.graphqlCustomResponses(),
      settings: this.settings,
    };
  };

  public graphqlResponses = (): GraphQLResponse[] => {
    const allResponses: GraphQLResponse[] = [];
    this.graphqlResponsesMap.forEach(responses => {
      allResponses.push(...responses);
    });
    return allResponses;
  };

  public graphqlCustomResponses = (): GraphQLCustomResponse[] => {
    return Array.from(this.graphqlCustomResponsesMap.values());
  };

  public getSettings = (): MockerSettings => {
    return this.settings;
  };

  public addGraphQLResponse = (response: GraphQLResponse) => {
    const existing = this.graphqlResponsesMap.get(response.operationName) || [];
    // Keep only last 10 responses per operation
    const updated = [response, ...existing].slice(0, 10);
    this.graphqlResponsesMap.set(response.operationName, updated);
    this.callbacks.forEach(f => f(this.tabId, this.dump()));
  };

  public setGraphQLCustomResponse = (customResponse: GraphQLCustomResponse) => {
    // If customResponse is null, delete the custom response
    if (customResponse.customResponse === null) {
      this.graphqlCustomResponsesMap.delete(customResponse.operationName);
    } else {
      this.graphqlCustomResponsesMap.set(customResponse.operationName, customResponse);
    }
    this.callbacks.forEach(f => f(this.tabId, this.dump()));
  };

  public setSettings = (settings: MockerSettings) => {
    this.settings = settings;
    this.callbacks.forEach(f => f(this.tabId, this.dump()));
  };

  public clearAll = () => {
    this.graphqlResponsesMap.clear();
    this.graphqlCustomResponsesMap.clear();
    this.callbacks.forEach(f => f(this.tabId, this.dump()));
  };

  public updateFrom = (msg: Message) => {
    switch (msg.type) {
      case MessageType.Snapshot:
        // Snapshot message is from this class, no action required
        break;
      case MessageType.SnapshotRequest:
        // Just trigger callback
        break;
      case MessageType.GraphQLResponseCaptured:
        if (msg.graphqlResponses) {
          msg.graphqlResponses.forEach(response => {
            this.addGraphQLResponse(response);
          });
        }
        break;
      case MessageType.GraphQLCustomResponseUpdate:
        if (msg.graphqlCustomResponses) {
          // Clear existing custom responses and set new ones
          this.graphqlCustomResponsesMap.clear();
          msg.graphqlCustomResponses.forEach(customResponse => {
            this.setGraphQLCustomResponse(customResponse);
          });
        }
        break;
      case MessageType.SettingsUpdate:
        if (msg.settings) {
          this.setSettings(msg.settings);
        }
        break;
      case MessageType.ClearAll:
        this.clearAll();
        break;
    }
    this.callbacks.forEach(f => f(this.tabId, this.dump()));
  };

  public registerCallback = (callback: Callback) => {
    this.callbacks.push(callback);
  };

  public toJSON = (): GraphQLMockerState => {
    return {
      tabId: this.tabId,
      graphqlResponses: this.graphqlResponses(),
      graphqlCustomResponses: this.graphqlCustomResponses(),
      settings: this.settings,
    };
  };

  public setupFromState = (state: GraphQLMockerState) => {
    this.tabId = state.tabId;

    // Restore GraphQL responses
    if (state.graphqlResponses) {
      state.graphqlResponses.forEach(response => {
        const existing = this.graphqlResponsesMap.get(response.operationName) || [];
        this.graphqlResponsesMap.set(response.operationName, [...existing, response]);
      });
    }

    // Restore GraphQL custom responses
    if (state.graphqlCustomResponses) {
      state.graphqlCustomResponses.forEach(customResponse => {
        this.graphqlCustomResponsesMap.set(customResponse.operationName, customResponse);
      });
    }

    // Restore settings
    if (state.settings) {
      this.settings = state.settings;
    }

    this.callbacks.forEach(f => f(this.tabId, this.dump()));
  };
}

export default Store;
