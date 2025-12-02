import { State, Message, GraphQLMockerState, GraphQLResponse, GraphQLCustomResponse } from "../type/type";
type Callback = (tabId: number, state: State) => void;
declare class Store {
    private graphqlResponsesMap;
    private graphqlCustomResponsesMap;
    tabId: number;
    private callbacks;
    constructor(tabId: number);
    dump: () => State;
    graphqlResponses: () => GraphQLResponse[];
    graphqlCustomResponses: () => GraphQLCustomResponse[];
    addGraphQLResponse: (response: GraphQLResponse) => void;
    setGraphQLCustomResponse: (customResponse: GraphQLCustomResponse) => void;
    updateFrom: (msg: Message) => void;
    registerCallback: (callback: Callback) => void;
    toJSON: () => GraphQLMockerState;
    setupFromState: (state: GraphQLMockerState) => void;
}
export default Store;
//# sourceMappingURL=store.d.ts.map