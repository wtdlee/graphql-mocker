// GraphQL Mocker Type Definitions

export enum MessageType {
  // Request to send back snapshot
  SnapshotRequest = "snapshot-fetch",
  // Publish current datastore snapshot
  Snapshot = "snapshot",
  // GraphQL related messages
  GraphQLResponseCaptured = "graphql-response-captured",
  GraphQLCustomResponseUpdate = "graphql-custom-response-update",
}

export interface GraphQLResponse {
  operationName: string;
  query?: string;
  variables?: any;
  response: any;
  timestamp: Date;
  url: string;
}

export interface GraphQLCustomResponse {
  operationName: string;
  customResponse: any | null;
  activated: boolean;
}

export interface State {
  graphqlResponses: GraphQLResponse[];
  graphqlCustomResponses: GraphQLCustomResponse[];
}

export type Message = {
  type: MessageType;
  graphqlResponses?: GraphQLResponse[];
  graphqlCustomResponses?: GraphQLCustomResponse[];
} & Partial<State>;

export type Payload = { to: string; from: string; msg: Message };

// The data type saved in chrome.storage.session
export interface GraphQLMockerState {
  tabId: number;
  graphqlResponses: GraphQLResponse[];
  graphqlCustomResponses: GraphQLCustomResponse[];
}
