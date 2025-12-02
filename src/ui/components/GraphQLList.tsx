import React, { useState, useMemo } from "react";
import styled from "styled-components";
import { GraphQLResponse, GraphQLCustomResponse } from "../../type/type";
import Colors from "../lib/colors";

type GraphQLListProps = {
  graphqlResponses: GraphQLResponse[];
  graphqlCustomResponses: GraphQLCustomResponse[];
  updateCustomResponse: (customResponse: GraphQLCustomResponse) => void;
};

const GraphQLList: React.FC<GraphQLListProps> = ({
  graphqlResponses,
  graphqlCustomResponses,
  updateCustomResponse,
}) => {
  const [selectedOperation, setSelectedOperation] = useState<string | null>(
    null
  );
  const [editingResponse, setEditingResponse] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Group responses by operationName
  const groupedResponses = useMemo(() => {
    const groups = new Map<string, GraphQLResponse[]>();
    graphqlResponses.forEach((response) => {
      const existing = groups.get(response.operationName) || [];
      groups.set(response.operationName, [...existing, response]);
    });
    return groups;
  }, [graphqlResponses]);

  // Get custom response map
  const customResponseMap = useMemo(() => {
    const map = new Map<string, GraphQLCustomResponse>();
    graphqlCustomResponses.forEach((cr) => {
      map.set(cr.operationName, cr);
    });
    return map;
  }, [graphqlCustomResponses]);

  const handleOperationClick = (operationName: string) => {
    if (selectedOperation === operationName) {
      setSelectedOperation(null);
      setShowEditor(false);
    } else {
      setSelectedOperation(operationName);
      const customResponse = customResponseMap.get(operationName);
      if (customResponse) {
        setEditingResponse(customResponse.customResponse);
      } else {
        const responses = groupedResponses.get(operationName);
        if (responses && responses.length > 0) {
          setEditingResponse(responses[0].response);
        } else {
          setEditingResponse({});
        }
      }
      setShowEditor(false);
    }
  };

  const handleToggleActivate = (operationName: string) => {
    const customResponse = customResponseMap.get(operationName);
    if (customResponse) {
      updateCustomResponse({
        ...customResponse,
        activated: !customResponse.activated,
      });
    }
  };

  const handleSaveCustomResponse = (operationName: string) => {
    try {
      const existingCustom = customResponseMap.get(operationName);
      const responseToSave = JSON.parse(JSON.stringify(editingResponse));
      updateCustomResponse({
        operationName,
        customResponse: responseToSave,
        activated: existingCustom?.activated || false,
      });
      setShowEditor(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert(`Failed to save: ${errorMessage}`);
    }
  };

  const handleDeleteCustomResponse = (operationName: string) => {
    updateCustomResponse({
      operationName,
      customResponse: null,
      activated: false,
    });
  };

  const handleOpenInWindow = (operationName: string) => {
    const responses = groupedResponses.get(operationName);
    const customResponse = customResponseMap.get(operationName);

    if (responses && responses.length > 0) {
      const data = {
        operationName,
        latestResponse: responses[0].response,
        customResponse: customResponse?.customResponse,
        activated: customResponse?.activated || false,
      };

      sessionStorage.setItem("graphql-editor-data", JSON.stringify(data));

      const width = 1000;
      const height = 800;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;

      window.open(
        `${chrome.runtime.getURL("popup.html")}#graphql-editor`,
        "GraphQL Editor",
        `width=${width},height=${height},left=${left},top=${top}`
      );
    }
  };

  return (
    <Container>
      <Header>
        <Logo>
          <LogoIcon>🎭</LogoIcon>
          <LogoText>GraphQL Mocker</LogoText>
        </Logo>
        <Description>
          Capture and mock GraphQL responses in real-time
        </Description>
      </Header>

      {groupedResponses.size === 0 ? (
        <EmptyState>
          <EmptyIcon>📡</EmptyIcon>
          <EmptyTitle>No GraphQL operations captured</EmptyTitle>
          <EmptyDescription>
            Navigate to a page that makes GraphQL requests.
            <br />
            All /graphql endpoints will be automatically intercepted.
          </EmptyDescription>
        </EmptyState>
      ) : (
        <OperationList>
          {Array.from(groupedResponses.entries()).map(
            ([operationName, responses]) => {
              const customResponse = customResponseMap.get(operationName);
              const isActive = customResponse?.activated || false;
              const hasCustom = !!customResponse;

              return (
                <OperationItem key={operationName}>
                  <OperationHeader
                    onClick={() => handleOperationClick(operationName)}
                    isSelected={selectedOperation === operationName}
                  >
                    <OperationInfo>
                      <OperationName>{operationName}</OperationName>
                      <OperationMeta>
                        {responses.length} response
                        {responses.length > 1 ? "s" : ""}
                        {hasCustom && (
                          <StatusBadge isActive={isActive}>
                            {isActive ? "Active" : "Custom"}
                          </StatusBadge>
                        )}
                      </OperationMeta>
                    </OperationInfo>
                    <ExpandIcon
                      isExpanded={selectedOperation === operationName}
                    />
                  </OperationHeader>

                  {selectedOperation === operationName && (
                    <OperationDetails>
                      {!showEditor && (
                        <Section>
                          <SectionTitle>Latest Response</SectionTitle>
                          <ResponsePreview>
                            <pre>
                              {JSON.stringify(responses[0].response, null, 2)}
                            </pre>
                          </ResponsePreview>
                        </Section>
                      )}

                      {hasCustom &&
                        !showEditor &&
                        customResponse?.customResponse && (
                          <Section>
                            <SectionTitle>Custom Response</SectionTitle>
                            <ResponsePreview>
                              <pre>
                                {JSON.stringify(
                                  customResponse.customResponse,
                                  null,
                                  2
                                )}
                              </pre>
                            </ResponsePreview>
                          </Section>
                        )}

                      {showEditor && (
                        <Section>
                          <SectionTitle>
                            {hasCustom
                              ? "Edit Custom Response"
                              : "Create Custom Response"}
                          </SectionTitle>
                          <EditorContainer>
                            <Editor
                              value={JSON.stringify(editingResponse, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  setEditingResponse(parsed);
                                } catch {
                                  // Keep typing even if JSON is temporarily invalid
                                }
                              }}
                              placeholder="Enter JSON response..."
                            />
                          </EditorContainer>
                        </Section>
                      )}

                      <ActionButtons>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenInWindow(operationName);
                          }}
                          variant="secondary"
                        >
                          Open Editor
                        </Button>
                        {!showEditor ? (
                          <>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowEditor(true);
                              }}
                            >
                              {hasCustom ? "Edit" : "Create Mock"}
                            </Button>
                            {hasCustom && (
                              <>
                                <Button
                                  variant={isActive ? "danger" : "primary"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleActivate(operationName);
                                  }}
                                >
                                  {isActive ? "Deactivate" : "Activate"}
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCustomResponse(operationName);
                                  }}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <Button
                              variant="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveCustomResponse(operationName);
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowEditor(false);
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </ActionButtons>
                    </OperationDetails>
                  )}
                </OperationItem>
              );
            }
          )}
        </OperationList>
      )}
    </Container>
  );
};

const Container = styled.div`
  width: 100%;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #fce4ec 0%, #f3e5f5 100%);
  overflow: auto;
`;

const Header = styled.div`
  margin-bottom: 24px;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
`;

const LogoIcon = styled.span`
  font-size: 32px;
`;

const LogoText = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(
    135deg,
    ${Colors.Primary500},
    ${Colors.Primary700}
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Description = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${Colors.Gray600};
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
`;

const EmptyIcon = styled.span`
  font-size: 48px;
  margin-bottom: 16px;
`;

const EmptyTitle = styled.h2`
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: ${Colors.Gray800};
`;

const EmptyDescription = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${Colors.Gray500};
  text-align: center;
  line-height: 1.6;
`;

const OperationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const OperationItem = styled.div`
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }
`;

const OperationHeader = styled.div<{ isSelected: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background-color: ${({ isSelected }) =>
    isSelected ? Colors.Gray50 : "white"};
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${Colors.Gray50};
  }
`;

const OperationInfo = styled.div`
  flex: 1;
`;

const OperationName = styled.div`
  font-weight: 600;
  font-size: 15px;
  color: ${Colors.Gray800};
  margin-bottom: 4px;
`;

const OperationMeta = styled.div`
  font-size: 13px;
  color: ${Colors.Gray500};
  display: flex;
  align-items: center;
  gap: 10px;
`;

const StatusBadge = styled.span<{ isActive: boolean }>`
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background-color: ${({ isActive }) =>
    isActive ? Colors.Green500 : Colors.Primary500};
  color: white;
`;

const ExpandIcon = styled.span<{ isExpanded: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  position: relative;

  &::before {
    content: "";
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 7px solid ${Colors.Gray400};
    transform: ${({ isExpanded }) =>
      isExpanded ? "rotate(180deg)" : "rotate(90deg)"};
    transition: transform 0.2s;
  }
`;

const OperationDetails = styled.div`
  padding: 20px;
  background-color: ${Colors.Gray50};
  border-top: 1px solid ${Colors.Gray200};
`;

const Section = styled.div`
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: ${Colors.Gray700};
`;

const ResponsePreview = styled.div`
  background-color: white;
  border: 1px solid ${Colors.Gray200};
  border-radius: 8px;
  padding: 16px;
  max-height: 300px;
  overflow: auto;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 12px;

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    color: ${Colors.Gray800};
  }
`;

const EditorContainer = styled.div`
  margin-bottom: 12px;
`;

const Editor = styled.textarea`
  width: 100%;
  min-height: 200px;
  padding: 16px;
  border: 2px solid ${Colors.Gray300};
  border-radius: 8px;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 12px;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: ${Colors.Primary500};
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
`;

const Button = styled.button<{ variant?: "primary" | "danger" | "secondary" }>`
  padding: 10px 18px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  ${({ variant }) => {
    switch (variant) {
      case "primary":
        return `
          background-color: ${Colors.Primary500};
          color: white;
          &:hover {
            background-color: ${Colors.Primary600};
            transform: translateY(-1px);
          }
        `;
      case "danger":
        return `
          background-color: ${Colors.Red500};
          color: white;
          &:hover {
            background-color: ${Colors.Red600};
            transform: translateY(-1px);
          }
        `;
      case "secondary":
        return `
          background-color: ${Colors.Green500};
          color: white;
          &:hover {
            background-color: ${Colors.Green600};
            transform: translateY(-1px);
          }
        `;
      default:
        return `
          background-color: ${Colors.Gray200};
          color: ${Colors.Gray700};
          &:hover {
            background-color: ${Colors.Gray300};
          }
        `;
    }
  }}
`;

export default GraphQLList;
