import React, { useEffect, useState, useCallback } from "react";
import styled from "styled-components";
import GraphQLList from "./components/GraphQLList";
import { GraphQLEditorWindow } from "./components/GraphQLEditorWindow";
import {
  MessageType,
  GraphQLResponse,
  GraphQLCustomResponse,
  State,
  Payload,
} from "../type/type";

interface AppProps {
  tabId: number;
}

const App: React.FC<AppProps> = ({ tabId }) => {
  const [isGraphQLEditor, setIsGraphQLEditor] = useState(false);
  const [graphqlResponses, setGraphqlResponses] = useState<GraphQLResponse[]>(
    []
  );
  const [graphqlCustomResponses, setGraphqlCustomResponses] = useState<
    GraphQLCustomResponse[]
  >([]);
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);

  useEffect(() => {
    // Check if we're in the GraphQL editor mode
    const hash = window.location.hash;
    setIsGraphQLEditor(hash === "#graphql-editor");

    const handleHashChange = () => {
      setIsGraphQLEditor(window.location.hash === "#graphql-editor");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Set up port connection
  useEffect(() => {
    if (isGraphQLEditor) return;

    const newPort = chrome.runtime.connect({ name: `popup/${tabId}` });
    setPort(newPort);

    newPort.onMessage.addListener((message: Payload) => {
      if (message.msg?.type === MessageType.Snapshot) {
        const state = message.msg as State;
        setGraphqlResponses(state.graphqlResponses || []);
        setGraphqlCustomResponses(state.graphqlCustomResponses || []);
      }
    });

    // Request initial state
    newPort.postMessage({
      from: "popup",
      to: "datastore",
      msg: { type: MessageType.SnapshotRequest },
    });

    return () => {
      newPort.disconnect();
    };
  }, [tabId, isGraphQLEditor]);

  // Listen for broadcast channel messages from editor window
  useEffect(() => {
    if (isGraphQLEditor) return;

    const channel = new BroadcastChannel("graphql-editor");
    channel.onmessage = (event) => {
      if (event.data.type === "save" && port) {
        const { operationName, customResponse, activated } = event.data;
        const allCustomResponses = [...graphqlCustomResponses];
        const existingIndex = allCustomResponses.findIndex(
          (cr) => cr.operationName === operationName
        );

        const newCustomResponse: GraphQLCustomResponse = {
          operationName,
          customResponse,
          activated,
        };

        if (existingIndex >= 0) {
          allCustomResponses[existingIndex] = newCustomResponse;
        } else {
          allCustomResponses.push(newCustomResponse);
        }

        port.postMessage({
          from: "popup",
          to: "datastore",
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
      if (!port) return;

      let updatedResponses: GraphQLCustomResponse[];

      if (customResponse.customResponse === null) {
        // Delete the custom response
        updatedResponses = graphqlCustomResponses.filter(
          (cr) => cr.operationName !== customResponse.operationName
        );
      } else {
        // Add or update the custom response
        const existingIndex = graphqlCustomResponses.findIndex(
          (cr) => cr.operationName === customResponse.operationName
        );

        if (existingIndex >= 0) {
          updatedResponses = [...graphqlCustomResponses];
          updatedResponses[existingIndex] = customResponse;
        } else {
          updatedResponses = [...graphqlCustomResponses, customResponse];
        }
      }

      port.postMessage({
        from: "popup",
        to: "datastore",
        msg: {
          type: MessageType.GraphQLCustomResponseUpdate,
          graphqlCustomResponses: updatedResponses,
        },
      });
    },
    [port, graphqlCustomResponses]
  );

  if (isGraphQLEditor) {
    return <GraphQLEditorWindow />;
  }

  return (
    <Container>
      <GraphQLList
        graphqlResponses={graphqlResponses}
        graphqlCustomResponses={graphqlCustomResponses}
        updateCustomResponse={updateCustomResponse}
      />
    </Container>
  );
};

const Container = styled.div`
  width: 100%;
  height: 100%;
`;

export default App;
