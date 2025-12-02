import { useState, useMemo, useCallback, useEffect } from 'react';
import styled, { css } from 'styled-components';
import {
  GraphQLResponse,
  GraphQLCustomResponse,
  MockerSettings,
  ExportData,
  DEFAULT_SETTINGS,
  JsonValue,
} from '../../type/type';

type GraphQLListProps = {
  graphqlResponses: GraphQLResponse[];
  graphqlCustomResponses: GraphQLCustomResponse[];
  settings: MockerSettings;
  updateCustomResponse: (customResponse: GraphQLCustomResponse) => void;
  updateSettings: (settings: MockerSettings) => void;
  onClearAll: () => void;
};

// Query viewer state type
interface QueryViewerState {
  isOpen: boolean;
  operationName: string;
  query: string;
}

const POPUP_WIDTH = 420;
const QUERY_PANEL_WIDTH = 370; // Max popup width is ~800px, so 420 + 370 = 790px

const GraphQLList: React.FC<GraphQLListProps> = ({
  graphqlResponses,
  graphqlCustomResponses,
  settings = DEFAULT_SETTINGS,
  updateCustomResponse,
  updateSettings,
  onClearAll,
}) => {
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [editingResponse, setEditingResponse] = useState<JsonValue>(null);
  const [editingDelay, setEditingDelay] = useState<number>(0);
  const [showEditor, setShowEditor] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [queryViewer, setQueryViewer] = useState<QueryViewerState>({
    isOpen: false,
    operationName: '',
    query: '',
  });

  // Handle body width change when query viewer opens/closes
  useEffect(() => {
    const body = document.body;
    if (queryViewer.isOpen) {
      body.style.width = `${POPUP_WIDTH + QUERY_PANEL_WIDTH}px`;
    } else {
      body.style.width = `${POPUP_WIDTH}px`;
    }
  }, [queryViewer.isOpen]);

  // Open query viewer
  const openQueryViewer = useCallback((operationName: string, query: string) => {
    setQueryViewer({
      isOpen: true,
      operationName,
      query,
    });
  }, []);

  // Close query viewer
  const closeQueryViewer = useCallback(() => {
    setQueryViewer(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  // Handle theme toggle - also broadcast to editor windows
  const handleThemeToggle = useCallback(() => {
    const newSettings = { ...settings, darkMode: !settings.darkMode };
    updateSettings(newSettings);

    // Broadcast theme change to editor windows
    const channel = new BroadcastChannel('graphql-theme');
    channel.postMessage({ type: 'theme-change', darkMode: newSettings.darkMode });
    channel.close();
  }, [settings, updateSettings]);

  // Group responses by operationName
  const groupedResponses = useMemo(() => {
    const groups = new Map<string, GraphQLResponse[]>();
    graphqlResponses.forEach(response => {
      const existing = groups.get(response.operationName) || [];
      groups.set(response.operationName, [...existing, response]);
    });
    return groups;
  }, [graphqlResponses]);

  // Get custom response map
  const customResponseMap = useMemo(() => {
    const map = new Map<string, GraphQLCustomResponse>();
    graphqlCustomResponses.forEach(cr => {
      map.set(cr.operationName, cr);
    });
    return map;
  }, [graphqlCustomResponses]);

  // Filtered responses based on search
  const filteredOperations = useMemo(() => {
    if (!searchQuery.trim()) {
      return Array.from(groupedResponses.entries());
    }
    const query = searchQuery.toLowerCase();
    return Array.from(groupedResponses.entries()).filter(([name]) =>
      name.toLowerCase().includes(query)
    );
  }, [groupedResponses, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = groupedResponses.size;
    const mocked = graphqlCustomResponses.filter(cr => cr.activated).length;
    return { total, mocked };
  }, [groupedResponses.size, graphqlCustomResponses]);

  const handleOperationClick = (operationName: string) => {
    if (selectedOperation === operationName) {
      setSelectedOperation(null);
      setShowEditor(false);
    } else {
      setSelectedOperation(operationName);
      const customResponse = customResponseMap.get(operationName);
      if (customResponse) {
        setEditingResponse(customResponse.customResponse);
        setEditingDelay(customResponse.delay || 0);
      } else {
        const responses = groupedResponses.get(operationName);
        if (responses && responses.length > 0) {
          setEditingResponse(responses[0].response);
        } else {
          setEditingResponse({});
        }
        setEditingDelay(0);
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
      const responseToSave = JSON.parse(JSON.stringify(editingResponse)) as JsonValue;
      updateCustomResponse({
        operationName,
        customResponse: responseToSave,
        activated: existingCustom?.activated || false,
        delay: editingDelay,
      });
      setShowEditor(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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

  const handleCopyJson = useCallback(async (data: JsonValue | undefined, id: string) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = JSON.stringify(data, null, 2);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const handleExport = useCallback(() => {
    const exportData: ExportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      customResponses: graphqlCustomResponses,
      settings,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `graphql-mocker-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [graphqlCustomResponses, settings]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as ExportData;
        if (data.customResponses) {
          data.customResponses.forEach(cr => updateCustomResponse(cr));
        }
        if (data.settings) {
          updateSettings(data.settings);
        }
        alert('Import successful!');
      } catch {
        alert('Failed to import: Invalid file format');
      }
    };
    input.click();
  }, [updateCustomResponse, updateSettings]);

  const handleOpenInWindow = (operationName: string) => {
    const responses = groupedResponses.get(operationName);
    const customResponse = customResponseMap.get(operationName);

    if (responses && responses.length > 0) {
      const data = {
        operationName,
        latestResponse: responses[0].response,
        customResponse: customResponse?.customResponse,
        activated: customResponse?.activated || false,
        delay: customResponse?.delay || 0,
        darkMode: settings.darkMode,
      };

      sessionStorage.setItem('graphql-editor-data', JSON.stringify(data));

      const width = 1000;
      const height = 800;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;

      window.open(
        `${chrome.runtime.getURL('popup.html')}#graphql-editor`,
        'GraphQL Editor',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderJsonPreview = (data: JsonValue | undefined, maxLength = 500) => {
    const json = JSON.stringify(data, null, 2);
    const truncated = json.length > maxLength ? json.slice(0, maxLength) + '\n...' : json;
    return truncated;
  };

  return (
    <MainWrapper $isExpanded={queryViewer.isOpen}>
      {/* Query Viewer Panel */}
      <QueryViewerPanel $isOpen={queryViewer.isOpen}>
        <QueryViewerHeader>
          <QueryViewerTitle>
            <QueryViewerIcon>📝</QueryViewerIcon>
            <span>{queryViewer.operationName}</span>
          </QueryViewerTitle>
          <QueryViewerActions>
            <CopyButton
              onClick={() => {
                void navigator.clipboard.writeText(queryViewer.query);
                setCopiedId('query-viewer');
                setTimeout(() => setCopiedId(null), 2000);
              }}
            >
              {copiedId === 'query-viewer' ? '✓ Copied' : '📋 Copy'}
            </CopyButton>
            <CloseButton onClick={closeQueryViewer}>✕</CloseButton>
          </QueryViewerActions>
        </QueryViewerHeader>
        <QueryViewerContent>
          <QueryCode>{queryViewer.query}</QueryCode>
        </QueryViewerContent>
      </QueryViewerPanel>

      <Container>
        {/* Header */}
        <Header>
          <HeaderTop>
            <Logo>
              <LogoIcon>⚡</LogoIcon>
              <LogoText>GraphQL Mocker</LogoText>
            </Logo>
            <HeaderActions>
              <ThemeToggle
                onClick={handleThemeToggle}
                title={settings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {settings.darkMode ? '☀️' : '🌙'}
              </ThemeToggle>
              <GlobalToggle
                $isActive={settings.globalMockEnabled}
                onClick={() =>
                  updateSettings({ ...settings, globalMockEnabled: !settings.globalMockEnabled })
                }
                title={settings.globalMockEnabled ? 'Disable all mocks' : 'Enable all mocks'}
              >
                <ToggleTrack $isActive={settings.globalMockEnabled}>
                  <ToggleThumb $isActive={settings.globalMockEnabled} />
                </ToggleTrack>
                <ToggleLabel>{settings.globalMockEnabled ? 'ON' : 'OFF'}</ToggleLabel>
              </GlobalToggle>
            </HeaderActions>
          </HeaderTop>

          <StatsBar>
            <StatItem>
              <StatValue>{stats.total}</StatValue>
              <StatLabel>Operations</StatLabel>
            </StatItem>
            <StatDivider />
            <StatItem>
              <StatValue $highlight>{stats.mocked}</StatValue>
              <StatLabel>Mocked</StatLabel>
            </StatItem>
          </StatsBar>

          <ToolBar>
            <SearchContainer>
              <SearchIcon>🔍</SearchIcon>
              <SearchInput
                type="text"
                placeholder="Search operations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <ClearSearchButton onClick={() => setSearchQuery('')}>×</ClearSearchButton>
              )}
            </SearchContainer>
            <ToolBarActions>
              <IconButton onClick={handleExport} title="Export mocks">
                📤
              </IconButton>
              <IconButton onClick={handleImport} title="Import mocks">
                📥
              </IconButton>
              <IconButton onClick={onClearAll} title="Clear all" $danger>
                🗑️
              </IconButton>
            </ToolBarActions>
          </ToolBar>
        </Header>

        {/* Content */}
        <Content>
          {filteredOperations.length === 0 ? (
            <EmptyState>
              {searchQuery ? (
                <>
                  <EmptyIcon>🔍</EmptyIcon>
                  <EmptyTitle>No results found</EmptyTitle>
                  <EmptyDescription>No operations match &quot;{searchQuery}&quot;</EmptyDescription>
                </>
              ) : (
                <>
                  <EmptyIcon>📡</EmptyIcon>
                  <EmptyTitle>No GraphQL operations captured</EmptyTitle>
                  <EmptyDescription>
                    Navigate to a page that makes GraphQL requests.
                    <br />
                    All /graphql endpoints will be automatically intercepted.
                  </EmptyDescription>
                </>
              )}
            </EmptyState>
          ) : (
            <OperationList>
              {filteredOperations.map(([operationName, responses]) => {
                const customResponse = customResponseMap.get(operationName);
                const isActive = customResponse?.activated && settings.globalMockEnabled;
                const hasCustom = !!customResponse?.customResponse;
                const latestResponse = responses[0];
                const isSelected = selectedOperation === operationName;

                return (
                  <OperationCard key={operationName} $isSelected={isSelected}>
                    <OperationHeader onClick={() => handleOperationClick(operationName)}>
                      <OperationInfo>
                        <OperationNameRow>
                          <OperationName>{operationName}</OperationName>
                          <BadgeGroup>
                            {isActive && <Badge $variant="active">MOCKED</Badge>}
                            {hasCustom && !isActive && <Badge $variant="custom">CUSTOM</Badge>}
                            {hasCustom && customResponse?.delay != null && (
                              <Badge $variant="delay">{customResponse.delay}ms</Badge>
                            )}
                          </BadgeGroup>
                        </OperationNameRow>
                        <OperationMeta>
                          <MetaItem>
                            <MetaIcon>📊</MetaIcon>
                            {responses.length} response{responses.length > 1 ? 's' : ''}
                          </MetaItem>
                          {latestResponse.duration && (
                            <MetaItem>
                              <MetaIcon>⏱️</MetaIcon>
                              {latestResponse.duration}ms
                            </MetaItem>
                          )}
                          <MetaItem>
                            <MetaIcon>🕐</MetaIcon>
                            {formatTimestamp(latestResponse.timestamp)}
                          </MetaItem>
                        </OperationMeta>
                      </OperationInfo>
                      <ExpandIcon $isExpanded={isSelected}>
                        <ChevronSvg viewBox="0 0 24 24">
                          <path d="M6 9l6 6 6-6" />
                        </ChevronSvg>
                      </ExpandIcon>
                    </OperationHeader>

                    {isSelected && (
                      <OperationDetails>
                        {/* Quick Actions */}
                        <QuickActions>
                          {hasCustom ? (
                            <>
                              <ActionButton
                                $variant={isActive ? 'danger' : 'success'}
                                onClick={() => handleToggleActivate(operationName)}
                              >
                                {isActive ? '⏸️ Deactivate' : '▶️ Activate'}
                              </ActionButton>
                              <ActionButton onClick={() => setShowEditor(true)}>
                                ✏️ Edit
                              </ActionButton>
                              <ActionButton
                                $variant="danger"
                                onClick={() => handleDeleteCustomResponse(operationName)}
                              >
                                🗑️ Delete
                              </ActionButton>
                            </>
                          ) : (
                            <ActionButton $variant="primary" onClick={() => setShowEditor(true)}>
                              ➕ Create Mock
                            </ActionButton>
                          )}
                          <ActionButton onClick={() => handleOpenInWindow(operationName)}>
                            🪟 Open Editor
                          </ActionButton>
                        </QuickActions>

                        {!showEditor && (
                          <>
                            {/* Latest Response Section */}
                            <Section>
                              <SectionHeader>
                                <SectionTitle>
                                  <SectionIcon>📥</SectionIcon>
                                  Latest Response
                                </SectionTitle>
                                <CopyButton
                                  onClick={() => {
                                    void handleCopyJson(
                                      latestResponse.response,
                                      `latest-${operationName}`
                                    );
                                  }}
                                >
                                  {copiedId === `latest-${operationName}` ? '✓ Copied' : '📋 Copy'}
                                </CopyButton>
                              </SectionHeader>
                              <JsonPreview>
                                <code>{renderJsonPreview(latestResponse.response)}</code>
                              </JsonPreview>
                            </Section>

                            {/* Custom Response Section */}
                            {hasCustom && (
                              <Section>
                                <SectionHeader>
                                  <SectionTitle>
                                    <SectionIcon>🎭</SectionIcon>
                                    Custom Response
                                    {isActive && <ActiveIndicator />}
                                  </SectionTitle>
                                  <CopyButton
                                    onClick={() => {
                                      void handleCopyJson(
                                        customResponse.customResponse,
                                        `custom-${operationName}`
                                      );
                                    }}
                                  >
                                    {copiedId === `custom-${operationName}`
                                      ? '✓ Copied'
                                      : '📋 Copy'}
                                  </CopyButton>
                                </SectionHeader>
                                <JsonPreview $isCustom>
                                  <code>{renderJsonPreview(customResponse.customResponse)}</code>
                                </JsonPreview>
                              </Section>
                            )}

                            {/* Query Info */}
                            {latestResponse.query && (
                              <Section>
                                <SectionHeader>
                                  <SectionTitle>
                                    <SectionIcon>📝</SectionIcon>
                                    Query
                                    <QueryLength>{latestResponse.query.length} chars</QueryLength>
                                  </SectionTitle>
                                  <QueryActions>
                                    <CopyButton
                                      onClick={() => {
                                        void handleCopyJson(
                                          latestResponse.query,
                                          `query-${operationName}`
                                        );
                                      }}
                                    >
                                      {copiedId === `query-${operationName}`
                                        ? '✓ Copied'
                                        : '📋 Copy'}
                                    </CopyButton>
                                    <ViewQueryButton
                                      onClick={() =>
                                        openQueryViewer(operationName, latestResponse.query || '')
                                      }
                                    >
                                      🔍 View
                                    </ViewQueryButton>
                                  </QueryActions>
                                </SectionHeader>
                                <QueryPreview>
                                  <code>{latestResponse.query}</code>
                                </QueryPreview>
                              </Section>
                            )}
                          </>
                        )}

                        {/* Editor Mode */}
                        {showEditor && (
                          <EditorSection>
                            <SectionTitle>
                              <SectionIcon>✏️</SectionIcon>
                              {hasCustom ? 'Edit Mock Response' : 'Create Mock Response'}
                            </SectionTitle>

                            <EditorTextarea
                              value={JSON.stringify(editingResponse, null, 2)}
                              onChange={e => {
                                try {
                                  const parsed = JSON.parse(e.target.value) as JsonValue;
                                  setEditingResponse(parsed);
                                } catch {
                                  // Keep typing even if JSON is temporarily invalid
                                }
                              }}
                              placeholder="Enter JSON response..."
                              spellCheck={false}
                            />

                            <DelayInput>
                              <DelayLabel>
                                <DelayIcon>⏱️</DelayIcon>
                                Response Delay
                              </DelayLabel>
                              <DelayInputField
                                type="number"
                                min="0"
                                max="30000"
                                step="100"
                                value={editingDelay}
                                onChange={e => setEditingDelay(Number(e.target.value))}
                              />
                              <DelayUnit>ms</DelayUnit>
                            </DelayInput>

                            <EditorActions>
                              <ActionButton
                                $variant="primary"
                                onClick={() => handleSaveCustomResponse(operationName)}
                              >
                                💾 Save
                              </ActionButton>
                              <ActionButton onClick={() => setShowEditor(false)}>
                                ✕ Cancel
                              </ActionButton>
                            </EditorActions>
                          </EditorSection>
                        )}
                      </OperationDetails>
                    )}
                  </OperationCard>
                );
              })}
            </OperationList>
          )}
        </Content>
      </Container>
    </MainWrapper>
  );
};

// Styled Components with theme from ThemeProvider
const MainWrapper = styled.div<{ $isExpanded: boolean }>`
  display: flex;
  flex-direction: row;
  width: ${props =>
    props.$isExpanded ? `${POPUP_WIDTH + QUERY_PANEL_WIDTH}px` : `${POPUP_WIDTH}px`};
  height: 600px;
`;

const QueryViewerPanel = styled.div<{ $isOpen: boolean }>`
  width: ${props => (props.$isOpen ? `${QUERY_PANEL_WIDTH}px` : '0')};
  height: 600px;
  background: ${props => props.theme.bg.secondary};
  border-right: ${props => (props.$isOpen ? `1px solid ${props.theme.border.primary}` : 'none')};
  display: ${props => (props.$isOpen ? 'flex' : 'none')};
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
`;

const QueryViewerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: ${props => props.theme.bg.primary};
  border-bottom: 1px solid ${props => props.theme.border.primary};
  flex-shrink: 0;
  gap: 8px;
`;

const QueryViewerTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.text.primary};
  min-width: 0;
  flex: 1;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const QueryViewerIcon = styled.span`
  font-size: 18px;
`;

const QueryViewerActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const CloseButton = styled.button`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.theme.bg.elevated};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 6px;
  color: ${props => props.theme.text.muted};
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.theme.semantic.error};
    border-color: ${props => props.theme.semantic.error};
    color: white;
  }
`;

const QueryViewerContent = styled.div`
  flex: 1;
  overflow: auto;
  padding: 12px;
  min-height: 0;
`;

const QueryCode = styled.pre`
  margin: 0;
  padding: 12px;
  background: ${props => props.theme.bg.primary};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 8px;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: ${props => props.theme.syntax.key};
  white-space: pre-wrap;
  word-break: break-word;
`;

const ViewQueryButton = styled.button`
  padding: 4px 10px;
  background: ${props => props.theme.semantic.info};
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    filter: brightness(1.1);
    transform: scale(1.02);
  }
`;

const Container = styled.div`
  width: ${POPUP_WIDTH}px;
  height: 600px;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.bg.primary};
  color: ${props => props.theme.text.primary};
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  flex-shrink: 0;
`;

const Header = styled.header`
  padding: 16px;
  background: ${props => props.theme.bg.secondary};
  border-bottom: 1px solid ${props => props.theme.border.primary};
`;

const HeaderTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const LogoIcon = styled.span`
  font-size: 24px;
`;

const LogoText = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(
    135deg,
    ${props => props.theme.brand.primary},
    ${props => props.theme.brand.secondary}
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ThemeToggle = styled.button`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.theme.bg.tertiary};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.theme.bg.hover};
    border-color: ${props => props.theme.border.secondary};
  }
`;

const GlobalToggle = styled.button<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: ${props =>
    props.$isActive ? props.theme.semantic.successBg : props.theme.bg.tertiary};
  border: 1px solid
    ${props => (props.$isActive ? props.theme.semantic.success : props.theme.border.primary)};
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props =>
      props.$isActive ? props.theme.semantic.success + '30' : props.theme.bg.hover};
  }
`;

const ToggleTrack = styled.div<{ $isActive: boolean }>`
  width: 36px;
  height: 20px;
  background: ${props => (props.$isActive ? props.theme.semantic.success : props.theme.bg.active)};
  border-radius: 10px;
  position: relative;
  transition: background 0.2s;
`;

const ToggleThumb = styled.div<{ $isActive: boolean }>`
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: ${props => (props.$isActive ? '18px' : '2px')};
  transition: left 0.2s;
`;

const ToggleLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${props => props.theme.text.secondary};
  min-width: 24px;
  text-align: center;
`;

const StatsBar = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: ${props => props.theme.bg.tertiary};
  border-radius: 8px;
  margin-bottom: 12px;
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const StatValue = styled.span<{ $highlight?: boolean }>`
  font-size: 20px;
  font-weight: 700;
  color: ${props => (props.$highlight ? props.theme.brand.primary : props.theme.text.primary)};
`;

const StatLabel = styled.span`
  font-size: 11px;
  color: ${props => props.theme.text.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatDivider = styled.div`
  width: 1px;
  height: 32px;
  background: ${props => props.theme.border.primary};
`;

const ToolBar = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const SearchContainer = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 12px;
  font-size: 14px;
  opacity: 0.6;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 36px;
  background: ${props => props.theme.bg.tertiary};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 8px;
  color: ${props => props.theme.text.primary};
  font-size: 14px;
  transition: all 0.2s;

  &::placeholder {
    color: ${props => props.theme.text.muted};
  }

  &:focus {
    outline: none;
    border-color: ${props => props.theme.brand.primary};
    background: ${props => props.theme.bg.elevated};
  }
`;

const ClearSearchButton = styled.button`
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  color: ${props => props.theme.text.muted};
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  line-height: 1;

  &:hover {
    color: ${props => props.theme.text.secondary};
  }
`;

const ToolBarActions = styled.div`
  display: flex;
  gap: 4px;
`;

const IconButton = styled.button<{ $danger?: boolean }>`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.theme.bg.tertiary};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;

  &:hover {
    background: ${props => (props.$danger ? props.theme.semantic.errorBg : props.theme.bg.hover)};
    border-color: ${props =>
      props.$danger ? props.theme.semantic.error : props.theme.border.secondary};
  }
`;

const Content = styled.main`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  text-align: center;
`;

const EmptyIcon = styled.span`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
`;

const EmptyTitle = styled.h2`
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.text.secondary};
`;

const EmptyDescription = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${props => props.theme.text.muted};
  line-height: 1.6;
`;

const OperationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const OperationCard = styled.div<{ $isSelected: boolean }>`
  background: ${props => props.theme.bg.secondary};
  border: 1px solid
    ${props => (props.$isSelected ? props.theme.brand.primary : props.theme.border.primary)};
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;

  ${props =>
    props.$isSelected &&
    css`
      box-shadow: 0 0 0 1px ${p => p.theme.brand.primary}40;
    `}

  &:hover {
    border-color: ${props =>
      props.$isSelected ? props.theme.brand.primary : props.theme.border.secondary};
  }
`;

const OperationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: ${props => props.theme.bg.hover};
  }
`;

const OperationInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const OperationNameRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 6px;
`;

const OperationName = styled.span`
  font-weight: 600;
  font-size: 14px;
  color: ${props => props.theme.text.primary};
  word-break: break-word;
  overflow-wrap: break-word;
`;

const BadgeGroup = styled.div`
  display: flex;
  gap: 6px;
`;

const Badge = styled.span<{ $variant: 'active' | 'custom' | 'delay' }>`
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;

  ${props => {
    switch (props.$variant) {
      case 'active':
        return css`
          background: ${p => p.theme.badge.activeBg};
          color: ${p => p.theme.badge.active};
        `;
      case 'custom':
        return css`
          background: ${p => p.theme.badge.customBg};
          color: ${p => p.theme.badge.custom};
        `;
      case 'delay':
        return css`
          background: ${p => p.theme.semantic.warningBg};
          color: ${p => p.theme.semantic.warning};
        `;
    }
  }}
`;

const OperationMeta = styled.div`
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: ${props => props.theme.text.muted};
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MetaIcon = styled.span`
  font-size: 12px;
`;

const ExpandIcon = styled.div<{ $isExpanded: boolean }>`
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
  transform: rotate(${props => (props.$isExpanded ? '180deg' : '0deg')});
`;

const ChevronSvg = styled.svg`
  width: 20px;
  height: 20px;
  fill: none;
  stroke: ${props => props.theme.text.muted};
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

const OperationDetails = styled.div`
  padding: 16px;
  border-top: 1px solid ${props => props.theme.border.primary};
  background: ${props => props.theme.bg.tertiary};
`;

const QuickActions = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'success' | 'danger' }>`
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;

  ${props => {
    switch (props.$variant) {
      case 'primary':
        return css`
          background: ${p => p.theme.brand.primary};
          border: none;
          color: white;
          &:hover {
            background: ${p => p.theme.brand.primaryHover};
          }
        `;
      case 'success':
        return css`
          background: ${p => p.theme.semantic.success};
          border: none;
          color: white;
          &:hover {
            opacity: 0.9;
          }
        `;
      case 'danger':
        return css`
          background: ${p => p.theme.semantic.errorBg};
          border: 1px solid ${p => p.theme.semantic.error};
          color: ${p => p.theme.semantic.error};
          &:hover {
            background: ${p => p.theme.semantic.error};
            color: white;
          }
        `;
      default:
        return css`
          background: ${p => p.theme.bg.elevated};
          border: 1px solid ${p => p.theme.border.primary};
          color: ${p => p.theme.text.secondary};
          &:hover {
            background: ${p => p.theme.bg.hover};
            border-color: ${p => p.theme.border.secondary};
          }
        `;
    }
  }}
`;

const Section = styled.div`
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.text.secondary};
  display: flex;
  align-items: center;
  gap: 6px;
`;

const SectionIcon = styled.span`
  font-size: 14px;
`;

const ActiveIndicator = styled.span`
  width: 8px;
  height: 8px;
  background: ${props => props.theme.semantic.success};
  border-radius: 50%;
  animation: pulse 2s infinite;

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;

const CopyButton = styled.button`
  padding: 4px 10px;
  background: ${props => props.theme.bg.elevated};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 4px;
  color: ${props => props.theme.text.muted};
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.theme.bg.hover};
    color: ${props => props.theme.text.secondary};
  }
`;

const JsonPreview = styled.pre<{ $isCustom?: boolean }>`
  margin: 0;
  padding: 12px;
  background: ${props => props.theme.bg.primary};
  border: 1px solid
    ${props => (props.$isCustom ? props.theme.brand.primary + '40' : props.theme.border.primary)};
  border-radius: 8px;
  overflow-x: auto;
  max-height: 200px;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  font-size: 12px;
  line-height: 1.5;

  code {
    color: ${props => props.theme.text.secondary};
  }
`;

const QueryPreview = styled.pre`
  margin: 0;
  padding: 12px;
  background: ${props => props.theme.bg.primary};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 8px;
  overflow: auto;
  max-height: 100px;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  font-size: 11px;
  line-height: 1.5;
  color: ${props => props.theme.syntax.key};
  white-space: pre-wrap;
  word-break: break-word;

  code {
    color: inherit;
  }
`;

const QueryLength = styled.span`
  font-size: 10px;
  font-weight: 400;
  color: ${props => props.theme.text.muted};
  margin-left: 8px;
`;

const QueryActions = styled.div`
  display: flex;
  gap: 8px;
`;

const EditorSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EditorTextarea = styled.textarea`
  width: 100%;
  min-height: 250px;
  padding: 14px;
  background: ${props => props.theme.bg.primary};
  border: 2px solid ${props => props.theme.border.primary};
  border-radius: 8px;
  color: ${props => props.theme.text.primary};
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.brand.primary};
  }

  &::placeholder {
    color: ${props => props.theme.text.muted};
  }
`;

const DelayInput = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: ${props => props.theme.bg.elevated};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 8px;
`;

const DelayLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: ${props => props.theme.text.secondary};
  font-weight: 500;
`;

const DelayIcon = styled.span`
  font-size: 14px;
`;

const DelayInputField = styled.input`
  width: 100px;
  padding: 8px 12px;
  background: ${props => props.theme.bg.primary};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 6px;
  color: ${props => props.theme.text.primary};
  font-size: 14px;
  font-weight: 500;
  text-align: center;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.brand.primary};
  }

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    opacity: 1;
  }
`;

const DelayUnit = styled.span`
  font-size: 13px;
  color: ${props => props.theme.text.muted};
`;

const EditorActions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

export default GraphQLList;
