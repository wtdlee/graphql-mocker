import { useState, useEffect, useMemo } from 'react';
import styled, { ThemeProvider, css, createGlobalStyle } from 'styled-components';
import { JSONEditor } from './JSONEditor';
import { darkTheme, lightTheme } from '../lib/colors';
import { JsonValue, JsonObject } from '../../type/type';

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
    margin: 0;
    padding: 0;
  }
`;

interface StoredData {
  operationName: string;
  latestResponse: JsonValue;
  customResponse?: JsonValue;
  activated: boolean;
  delay?: number;
  darkMode?: boolean;
}

export const GraphQLEditorWindow: React.FC = () => {
  const [data, setData] = useState<StoredData | null>(null);
  const [editedData, setEditedData] = useState<JsonValue>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [delay, setDelay] = useState<number>(0);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    const storedData = sessionStorage.getItem('graphql-editor-data');
    if (storedData) {
      const parsed = JSON.parse(storedData) as StoredData;
      setData(parsed);
      setEditedData(parsed.customResponse || parsed.latestResponse);
      setDelay(parsed.delay || 0);
      setIsDarkMode(parsed.darkMode !== false);
    }
  }, []);

  // Listen for theme changes from popup
  useEffect(() => {
    interface ThemeChangeMessage {
      type: string;
      darkMode: boolean;
    }

    const channel = new BroadcastChannel('graphql-theme');
    channel.onmessage = (event: MessageEvent<ThemeChangeMessage>) => {
      const data = event.data;
      if (data.type === 'theme-change') {
        setIsDarkMode(data.darkMode);
      }
    };
    return () => channel.close();
  }, []);

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!editedData || !searchQuery.trim()) {
      return editedData;
    }

    const search = searchQuery.toLowerCase().trim();

    const filterObject = (obj: JsonValue, parentMatches = false): JsonValue | undefined => {
      if (obj === null) {
        return parentMatches ? obj : undefined;
      }

      if (typeof obj !== 'object') {
        // obj is a primitive type at this point (string, number, boolean)
        const stringValue = String(obj);
        const valueMatches = stringValue.toLowerCase().includes(search);
        return valueMatches || parentMatches ? obj : undefined;
      }

      if (Array.isArray(obj)) {
        const filtered = obj
          .map(item => filterObject(item, parentMatches))
          .filter((item): item is JsonValue => item !== undefined);
        return filtered.length > 0 ? filtered : parentMatches ? obj : undefined;
      }

      const objRecord: JsonObject = obj;
      const filtered: JsonObject = {};
      let hasMatch = false;

      for (const [key, value] of Object.entries(objRecord)) {
        const keyMatches = key.toLowerCase().includes(search);

        if (keyMatches) {
          filtered[key] = value;
          hasMatch = true;
          continue;
        }

        if (typeof value !== 'object' || value === null) {
          // value is a primitive type at this point
          const stringValue = value === null ? 'null' : String(value);
          const valueMatches = stringValue.toLowerCase().includes(search);
          if (valueMatches) {
            filtered[key] = value;
            hasMatch = true;
            continue;
          }
        }

        if (typeof value === 'object' && value !== null) {
          const filteredValue = filterObject(value, parentMatches);
          if (filteredValue !== undefined) {
            if (Array.isArray(filteredValue) && filteredValue.length > 0) {
              filtered[key] = filteredValue;
              hasMatch = true;
            } else if (
              !Array.isArray(filteredValue) &&
              typeof filteredValue === 'object' &&
              filteredValue !== null &&
              Object.keys(filteredValue).length > 0
            ) {
              filtered[key] = filteredValue;
              hasMatch = true;
            }
          }
        }
      }

      return hasMatch ? filtered : undefined;
    };

    const result = filterObject(editedData);
    return result !== undefined ? result : {};
  }, [editedData, searchQuery]);

  const handleSave = () => {
    if (data) {
      const channel = new BroadcastChannel('graphql-editor');
      channel.postMessage({
        type: 'save',
        operationName: data.operationName,
        customResponse: editedData,
        activated: true, // Auto-activate on save
        delay,
      });
      channel.close();

      // Show saved state
      setIsSaved(true);
    }
  };

  if (!data) {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <Container>
          <LoadingState>
            <LoadingIcon>⚡</LoadingIcon>
            <LoadingText>Loading...</LoadingText>
          </LoadingState>
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Container>
        <Header>
          <HeaderLeft>
            <Logo>⚡</Logo>
            <HeaderInfo>
              <Title>{data.operationName}</Title>
              <Subtitle>GraphQL Response Editor</Subtitle>
            </HeaderInfo>
          </HeaderLeft>
          <HeaderRight>{data.activated && <ActiveBadge>🟢 Mock Active</ActiveBadge>}</HeaderRight>
        </Header>

        <MainContent>
          <Toolbar>
            <SearchContainer>
              <SearchIcon>🔍</SearchIcon>
              <SearchInput
                type="text"
                placeholder="Search keys or values..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && <ClearButton onClick={() => setSearchQuery('')}>×</ClearButton>}
            </SearchContainer>

            <DelayContainer>
              <DelayLabel>⏱️ Delay</DelayLabel>
              <DelayInput
                type="number"
                min="0"
                max="30000"
                step="100"
                value={delay}
                onChange={e => setDelay(Number(e.target.value))}
              />
              <DelayUnit>ms</DelayUnit>
            </DelayContainer>
          </Toolbar>

          {searchQuery && (
            <SearchNote>
              <SearchNoteIcon>ℹ️</SearchNoteIcon>
              Search results are read-only. Clear the search to edit the response.
            </SearchNote>
          )}

          <EditorWrapper>
            <EditorHeader>
              <EditorTitle>
                {searchQuery ? `Search Results: "${searchQuery}"` : 'Response Editor'}
              </EditorTitle>
            </EditorHeader>
            <EditorContent>
              {searchQuery ? (
                <JSONEditor
                  data={filteredData}
                  originalData={filteredData}
                  onChange={() => undefined}
                />
              ) : (
                <JSONEditor
                  data={editedData}
                  originalData={data.latestResponse}
                  onChange={setEditedData}
                />
              )}
            </EditorContent>
          </EditorWrapper>
        </MainContent>

        <Footer>
          <FooterLeft>
            {isSaved ? (
              <SavedMessage>✅ Saved and activated! You can close this window.</SavedMessage>
            ) : (
              <HelpText>
                💡 Click values to edit • Modified fields are highlighted • Use Reset to restore
              </HelpText>
            )}
          </FooterLeft>
          <FooterRight>
            <Button onClick={() => window.close()}>{isSaved ? '✕ Close' : 'Cancel'}</Button>
            {!isSaved && (
              <Button $variant="primary" onClick={handleSave}>
                💾 Save & Activate
              </Button>
            )}
          </FooterRight>
        </Footer>
      </Container>
    </ThemeProvider>
  );
};

// Styled Components with theme from ThemeProvider
const Container = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.bg.primary};
  color: ${props => props.theme.text.primary};
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  overflow: hidden;
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
`;

const LoadingIcon = styled.span`
  font-size: 48px;
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(0.95);
    }
  }
`;

const LoadingText = styled.p`
  margin: 0;
  font-size: 16px;
  color: ${props => props.theme.text.muted};
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: ${props => props.theme.bg.secondary};
  border-bottom: 1px solid ${props => props.theme.border.primary};
  flex-shrink: 0;
  gap: 16px;
  flex-wrap: wrap;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  flex: 1;
`;

const Logo = styled.span`
  font-size: 32px;
  flex-shrink: 0;
`;

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.text.primary};
  word-break: break-word;
`;

const Subtitle = styled.span`
  font-size: 12px;
  color: ${props => props.theme.text.muted};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
`;

const ActiveBadge = styled.span`
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => props.theme.semantic.successBg};
  color: ${props => props.theme.semantic.success};
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  overflow: hidden;
  gap: 16px;
`;

const Toolbar = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
`;

const SearchContainer = styled.div`
  flex: 1;
  min-width: 200px;
  position: relative;
  display: flex;
  align-items: center;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 14px;
  font-size: 14px;
  opacity: 0.6;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 40px;
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

const ClearButton = styled.button`
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  color: ${props => props.theme.text.muted};
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;

  &:hover {
    color: ${props => props.theme.text.secondary};
  }
`;

const DelayContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: ${props => props.theme.bg.tertiary};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 8px;
`;

const DelayLabel = styled.label`
  font-size: 13px;
  color: ${props => props.theme.text.secondary};
  font-weight: 500;
`;

const DelayInput = styled.input`
  width: 80px;
  padding: 6px 10px;
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
`;

const DelayUnit = styled.span`
  font-size: 13px;
  color: ${props => props.theme.text.muted};
`;

const SearchNote = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: ${props => props.theme.semantic.warningBg};
  border: 1px solid ${props => props.theme.semantic.warning}40;
  border-radius: 8px;
  font-size: 13px;
  color: ${props => props.theme.semantic.warning};
`;

const SearchNoteIcon = styled.span`
  font-size: 14px;
`;

const EditorWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.bg.secondary};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 12px;
  overflow: hidden;
  min-height: 0;
`;

const EditorHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: ${props => props.theme.bg.tertiary};
  border-bottom: 1px solid ${props => props.theme.border.primary};
`;

const EditorTitle = styled.h2`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.text.secondary};
`;

const EditorContent = styled.div`
  flex: 1;
  overflow: auto;
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
`;

const Footer = styled.footer`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: ${props => props.theme.bg.secondary};
  border-top: 1px solid ${props => props.theme.border.primary};
  flex-shrink: 0;
  gap: 16px;
  flex-wrap: wrap;
`;

const FooterLeft = styled.div`
  flex: 1;
  min-width: 200px;
`;

const HelpText = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${props => props.theme.text.muted};
`;

const SavedMessage = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.semantic.success};
`;

const FooterRight = styled.div`
  display: flex;
  gap: 10px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'danger' }>`
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
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
          background: ${p => p.theme.bg.tertiary};
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
