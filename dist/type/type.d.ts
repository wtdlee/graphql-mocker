export declare enum MessageType {
    SnapshotRequest = "snapshot-fetch",
    Snapshot = "snapshot",
    GraphQLResponseCaptured = "graphql-response-captured",
    GraphQLCustomResponseUpdate = "graphql-custom-response-update"
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
export type Payload = {
    to: string;
    from: string;
    msg: Message;
};
export interface GraphQLMockerState {
    tabId: number;
    graphqlResponses: GraphQLResponse[];
    graphqlCustomResponses: GraphQLCustomResponse[];
}
//# sourceMappingURL=type.d.ts.map