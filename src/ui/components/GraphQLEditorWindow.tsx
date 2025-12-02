import React, { useState, useEffect, useMemo } from "react";
import styled from "styled-components";
import { JSONEditor } from "./JSONEditor";
import Colors from "../lib/colors";

export const GraphQLEditorWindow: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [editedData, setEditedData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    const storedData = sessionStorage.getItem("graphql-editor-data");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      setData(parsed);
      setEditedData(parsed.customResponse || parsed.latestResponse);
    }
  }, []);

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!editedData || !searchQuery.trim()) {
      return editedData;
    }

    const search = searchQuery.toLowerCase().trim();

    const filterObject = (obj: any, parentMatches = false): any => {
      if (obj === null || obj === undefined) {
        return parentMatches ? obj : undefined;
      }

      if (typeof obj !== "object") {
        const valueMatches = String(obj).toLowerCase().includes(search);
        return valueMatches || parentMatches ? obj : undefined;
      }

      if (Array.isArray(obj)) {
        const filtered = obj
          .map((item) => filterObject(item, parentMatches))
          .filter((item) => item !== undefined);
        return filtered.length > 0 ? filtered : parentMatches ? obj : undefined;
      }

      const filtered: any = {};
      let hasMatch = false;

      for (const [key, value] of Object.entries(obj)) {
        const keyMatches = key.toLowerCase().includes(search);

        if (keyMatches) {
          filtered[key] = value;
          hasMatch = true;
          continue;
        }

        if (typeof value !== "object") {
          const valueMatches = String(value).toLowerCase().includes(search);
          if (valueMatches) {
            filtered[key] = value;
            hasMatch = true;
            continue;
          }
        }

        if (typeof value === "object" && value !== null) {
          const filteredValue = filterObject(value, parentMatches);
          if (filteredValue !== undefined) {
            if (Array.isArray(filteredValue) && filteredValue.length > 0) {
              filtered[key] = filteredValue;
              hasMatch = true;
            } else if (
              !Array.isArray(filteredValue) &&
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
      const channel = new BroadcastChannel("graphql-editor");
      channel.postMessage({
        type: "save",
        operationName: data.operationName,
        customResponse: editedData,
        activated: data.activated,
      });
      channel.close();

      alert("Saved successfully! Go back to the main popup to activate.");
    }
  };

  if (!data) {
    return (
      <Container>
        <LoadingState>
          <LoadingIcon>🔄</LoadingIcon>
          <LoadingText>Loading...</LoadingText>
        </LoadingState>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderContent>
          <Logo>🎭</Logo>
          <HeaderInfo>
            <Title>{data.operationName}</Title>
            {data.activated && <ActiveBadge>Active Mock</ActiveBadge>}
          </HeaderInfo>
        </HeaderContent>
      </Header>

      <SearchSection>
        <SearchInput
          type="text"
          placeholder="Search keys or values... (e.g., 'user', 'email', 'id')"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <ClearButton onClick={() => setSearchQuery("")}>Clear</ClearButton>
        )}
      </SearchSection>

      <EditorSection>
        <SectionHeader>
          <SectionTitle>Response Editor</SectionTitle>
          {searchQuery && (
            <SearchInfo>Filtered by: "{searchQuery}" - Read-only</SearchInfo>
          )}
        </SectionHeader>
        {searchQuery ? (
          <>
            <SearchNote>
              Search results are read-only. Clear the search to edit the
              response.
            </SearchNote>
            <JSONEditor
              data={filteredData}
              originalData={filteredData}
              onChange={() => undefined}
            />
          </>
        ) : (
          <JSONEditor
            data={editedData}
            originalData={data.latestResponse}
            onChange={setEditedData}
          />
        )}
      </EditorSection>

      <ActionBar>
        <Button variant="primary" onClick={handleSave}>
          Save Changes
        </Button>
        <Button onClick={() => window.close()}>Close Window</Button>
      </ActionBar>

      <HelpSection>
        <HelpTitle>How to use:</HelpTitle>
        <HelpList>
          <li>Click on any value to edit it directly</li>
          <li>Modified fields show a yellow highlight and "Modified" badge</li>
          <li>Use "Reset" to restore original values</li>
          <li>Save your changes and activate the mock from the main popup</li>
        </HelpList>
      </HelpSection>
    </Container>
  );
};

const Container = styled.div`
  padding: 24px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  background: linear-gradient(135deg, #fce4ec 0%, #f3e5f5 100%);
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const LoadingIcon = styled.span`
  font-size: 48px;
  animation: spin 1s linear infinite;
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const LoadingText = styled.p`
  margin-top: 16px;
  font-size: 16px;
  color: ${Colors.Gray600};
`;

const Header = styled.header`
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const Logo = styled.span`
  font-size: 36px;
`;

const HeaderInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: ${Colors.Gray800};
`;

const ActiveBadge = styled.span`
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  background-color: ${Colors.Green500};
  color: white;
`;

const SearchSection = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 14px 20px;
  border: 2px solid ${Colors.Gray300};
  border-radius: 10px;
  font-size: 14px;
  background: white;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    outline: none;
    border-color: ${Colors.Primary500};
    box-shadow: 0 0 0 4px rgba(233, 30, 99, 0.1);
  }

  &::placeholder {
    color: ${Colors.Gray400};
  }
`;

const ClearButton = styled.button`
  padding: 14px 20px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background-color: ${Colors.Gray200};
  color: ${Colors.Gray700};
  transition: all 0.2s;

  &:hover {
    background-color: ${Colors.Gray300};
  }
`;

const EditorSection = styled.div`
  flex: 1;
  overflow: auto;
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${Colors.Gray800};
`;

const SearchInfo = styled.span`
  font-size: 13px;
  color: ${Colors.Primary600};
  font-weight: 500;
`;

const SearchNote = styled.div`
  background-color: ${Colors.Orange100};
  border: 1px solid ${Colors.Orange400};
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: ${Colors.Gray700};
`;

const ActionBar = styled.div`
  display: flex;
  gap: 12px;
  padding: 20px 0;
`;

const Button = styled.button<{ variant?: "primary" | "danger" }>`
  padding: 14px 24px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  ${({ variant }) => {
    switch (variant) {
      case "primary":
        return `
          background: linear-gradient(135deg, ${Colors.Primary500}, ${Colors.Primary600});
          color: white;
          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(233, 30, 99, 0.3);
          }
        `;
      case "danger":
        return `
          background-color: ${Colors.Red500};
          color: white;
          &:hover {
            background-color: ${Colors.Red600};
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

const HelpSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  margin-top: auto;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
`;

const HelpTitle = styled.h3`
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: ${Colors.Gray700};
`;

const HelpList = styled.ul`
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: ${Colors.Gray600};
  line-height: 1.6;

  li {
    margin-bottom: 4px;
  }
`;
