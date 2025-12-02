// GraphQL Mocker Type Definitions

// JSON-compatible types for GraphQL responses
export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

export enum MessageType {
  // Request to send back snapshot
  SnapshotRequest = 'snapshot-fetch',
  // Publish current datastore snapshot
  Snapshot = 'snapshot',
  // GraphQL related messages
  GraphQLResponseCaptured = 'graphql-response-captured',
  GraphQLCustomResponseUpdate = 'graphql-custom-response-update',
  // Settings
  SettingsUpdate = 'settings-update',
  // Clear all
  ClearAll = 'clear-all',
  // Keep-alive ping to prevent service worker from sleeping
  Ping = 'ping',
}

export interface GraphQLResponse {
  operationName: string;
  query?: string;
  variables?: JsonObject;
  response: JsonValue;
  timestamp: number; // Unix timestamp
  url: string;
  duration?: number; // Response time in ms
}

export interface GraphQLCustomResponse {
  operationName: string;
  customResponse: JsonValue;
  activated: boolean;
  delay?: number; // Delay in ms before returning response
}

export interface MockerSettings {
  globalMockEnabled: boolean;
  darkMode: boolean;
}

export interface State {
  type?: MessageType;
  graphqlResponses: GraphQLResponse[];
  graphqlCustomResponses: GraphQLCustomResponse[];
  settings: MockerSettings;
}

export type Message = {
  type: MessageType;
  graphqlResponses?: GraphQLResponse[];
  graphqlCustomResponses?: GraphQLCustomResponse[];
  settings?: MockerSettings;
} & Partial<State>;

export type Payload = { to: string; from: string; msg: Message };

// The data type saved in chrome.storage.session
export interface GraphQLMockerState {
  tabId: number;
  graphqlResponses: GraphQLResponse[];
  graphqlCustomResponses: GraphQLCustomResponse[];
  settings: MockerSettings;
}

// Export/Import format
export interface ExportData {
  version: string;
  exportedAt: string;
  customResponses: GraphQLCustomResponse[];
  settings: MockerSettings;
}

// Default settings
export const DEFAULT_SETTINGS: MockerSettings = {
  globalMockEnabled: true,
  darkMode: true,
};
