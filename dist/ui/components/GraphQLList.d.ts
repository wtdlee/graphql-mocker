import React from "react";
import { GraphQLResponse, GraphQLCustomResponse } from "../../type/type";
type GraphQLListProps = {
    graphqlResponses: GraphQLResponse[];
    graphqlCustomResponses: GraphQLCustomResponse[];
    updateCustomResponse: (customResponse: GraphQLCustomResponse) => void;
};
declare const GraphQLList: React.FC<GraphQLListProps>;
export default GraphQLList;
//# sourceMappingURL=GraphQLList.d.ts.map