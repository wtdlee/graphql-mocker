import React, { useState, useCallback } from "react";
import styled from "styled-components";
import Colors from "../lib/colors";

interface JSONEditorProps {
  data: any;
  originalData?: any;
  onChange: (newData: any) => void;
}

interface FieldEditorProps {
  path: string[];
  value: any;
  originalValue?: any;
  onChange: (path: string[], newValue: any) => void;
  isExpanded: boolean;
  onToggleExpand: (path: string[]) => void;
  expandedPaths: Set<string>;
}

const FieldEditor: React.FC<FieldEditorProps> = ({
  path,
  value,
  originalValue,
  onChange,
  isExpanded,
  onToggleExpand,
  expandedPaths,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const pathKey = path.join(".");
  const isObject =
    value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isModified =
    originalValue !== undefined &&
    JSON.stringify(value) !== JSON.stringify(originalValue);

  const handleStartEdit = () => {
    setEditValue(typeof value === "string" ? value : JSON.stringify(value));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    try {
      let newValue: any;
      if (typeof value === "string") {
        newValue = editValue;
      } else if (typeof value === "number") {
        newValue = parseFloat(editValue);
      } else if (typeof value === "boolean") {
        newValue = editValue === "true";
      } else {
        newValue = JSON.parse(editValue);
      }
      onChange(path, newValue);
      setIsEditing(false);
    } catch (e) {
      alert("Invalid value format");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleResetToOriginal = () => {
    if (originalValue !== undefined) {
      onChange(path, originalValue);
    }
  };

  if (isObject || isArray) {
    const entries: [string, any][] = isObject
      ? Object.entries(value)
      : value.map((v: any, i: number) => [String(i), v]);

    return (
      <FieldContainer>
        <FieldHeader isModified={isModified}>
          <ExpandButton
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggleExpand(path);
            }}
            isExpanded={isExpanded}
            type="button"
          />
          <FieldKey>{path[path.length - 1] || "root"}</FieldKey>
          <FieldType>{isArray ? `Array[${value.length}]` : "Object"}</FieldType>
          {isModified && (
            <>
              <ModifiedBadge>Modified</ModifiedBadge>
              <ResetButton
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetToOriginal();
                }}
              >
                Reset
              </ResetButton>
            </>
          )}
        </FieldHeader>
        {isExpanded && (
          <FieldChildren>
            {entries.map(([key, val]) => {
              const childPath = [...path, key];
              const childPathKey = childPath.join(".");
              const childIsExpanded = expandedPaths.has(childPathKey);
              return (
                <FieldEditor
                  key={`${pathKey}.${key}`}
                  path={childPath}
                  value={val}
                  originalValue={
                    originalValue !== undefined
                      ? isArray
                        ? originalValue[parseInt(key)]
                        : originalValue[key]
                      : undefined
                  }
                  onChange={onChange}
                  isExpanded={childIsExpanded}
                  onToggleExpand={onToggleExpand}
                  expandedPaths={expandedPaths}
                />
              );
            })}
          </FieldChildren>
        )}
      </FieldContainer>
    );
  }

  return (
    <FieldContainer>
      <FieldRow isModified={isModified}>
        <FieldKey>{path[path.length - 1]}</FieldKey>
        {isEditing ? (
          <>
            <ValueInput
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <ActionButton
              onClick={(e) => {
                e.stopPropagation();
                handleSaveEdit();
              }}
            >
              Save
            </ActionButton>
            <ActionButton
              onClick={(e) => {
                e.stopPropagation();
                handleCancelEdit();
              }}
            >
              Cancel
            </ActionButton>
          </>
        ) : (
          <>
            <FieldValue
              onClick={(e) => {
                e.stopPropagation();
                handleStartEdit();
              }}
              title="Click to edit"
            >
              {typeof value === "string" ? `"${value}"` : String(value)}
            </FieldValue>
            <FieldType>{typeof value}</FieldType>
            {isModified && (
              <>
                <ModifiedBadge>Modified</ModifiedBadge>
                <OriginalValue>Original: {String(originalValue)}</OriginalValue>
                <ResetButton
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetToOriginal();
                  }}
                >
                  Reset
                </ResetButton>
              </>
            )}
            <EditButton
              onClick={(e) => {
                e.stopPropagation();
                handleStartEdit();
              }}
            >
              Edit
            </EditButton>
          </>
        )}
      </FieldRow>
    </FieldContainer>
  );
};

export const JSONEditor: React.FC<JSONEditorProps> = ({
  data,
  originalData,
  onChange,
}) => {
  // Initialize with all paths expanded
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const getAllPaths = (
      obj: any,
      currentPath: string[] = ["root"]
    ): string[] => {
      const paths: string[] = [currentPath.join(".")];

      if (obj !== null && typeof obj === "object") {
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            const newPath = [...currentPath, String(index)];
            paths.push(...getAllPaths(item, newPath));
          });
        } else {
          Object.entries(obj).forEach(([key, value]) => {
            const newPath = [...currentPath, key];
            paths.push(...getAllPaths(value, newPath));
          });
        }
      }

      return paths;
    };

    const allPaths = getAllPaths(data);
    return new Set(allPaths);
  });

  const handleToggleExpand = useCallback((path: string[]) => {
    const pathKey = path.join(".");
    setExpandedPaths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pathKey)) {
        newSet.delete(pathKey);
      } else {
        newSet.add(pathKey);
      }
      return newSet;
    });
  }, []);

  const handleFieldChange = useCallback(
    (path: string[], newValue: any) => {
      const newData = JSON.parse(JSON.stringify(data));
      let current = newData;

      // Navigate to the parent
      for (let i = 1; i < path.length - 1; i++) {
        current = current[path[i]];
      }

      // Set the value
      const lastKey = path[path.length - 1];
      current[lastKey] = newValue;

      onChange(newData);
    },
    [data, onChange]
  );

  return (
    <EditorContainer>
      <FieldEditor
        path={["root"]}
        value={data}
        originalValue={originalData}
        onChange={handleFieldChange}
        isExpanded={expandedPaths.has("root")}
        onToggleExpand={handleToggleExpand}
        expandedPaths={expandedPaths}
      />
    </EditorContainer>
  );
};

const EditorContainer = styled.div`
  background-color: white;
  border: 1px solid ${Colors.Gray300};
  border-radius: 8px;
  padding: 16px;
  max-height: 500px;
  overflow: auto;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 13px;
`;

const FieldContainer = styled.div`
  margin-left: 16px;
`;

const FieldHeader = styled.div<{ isModified?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  background-color: ${({ isModified }) =>
    isModified ? "#fef3c7" : "transparent"};
  border-radius: 4px;
`;

const FieldRow = styled.div<{ isModified?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  background-color: ${({ isModified }) =>
    isModified ? "#fef3c7" : "transparent"};
  border-radius: 4px;
`;

const ExpandButton = styled.button<{ isExpanded: boolean }>`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  &:hover::after {
    border-left-color: ${Colors.Primary500};
  }

  &::after {
    content: "";
    display: inline-block;
    width: 0;
    height: 0;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-left: 5px solid ${Colors.Gray600};
    transform: ${({ isExpanded }) =>
      isExpanded ? "rotate(90deg)" : "rotate(0deg)"};
    transition: transform 0.2s;
  }
`;

const FieldKey = styled.span`
  font-weight: 600;
  color: ${Colors.Primary700};
`;

const FieldValue = styled.span`
  color: ${Colors.Gray800};
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;

  &:hover {
    background-color: ${Colors.Gray100};
  }
`;

const FieldType = styled.span`
  color: ${Colors.Gray500};
  font-size: 10px;
  text-transform: uppercase;
`;

const ModifiedBadge = styled.span`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  background-color: ${Colors.Orange500};
  color: white;
`;

const OriginalValue = styled.span`
  color: ${Colors.Gray500};
  font-size: 11px;
  font-style: italic;
`;

const FieldChildren = styled.div`
  margin-left: 8px;
  border-left: 2px solid ${Colors.Gray200};
  padding-left: 8px;
`;

const ValueInput = styled.input`
  flex: 1;
  padding: 4px 8px;
  border: 2px solid ${Colors.Primary500};
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: ${Colors.Primary600};
  }
`;

const ActionButton = styled.button`
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  background-color: ${Colors.Primary500};
  color: white;

  &:hover {
    background-color: ${Colors.Primary600};
  }
`;

const EditButton = styled.button`
  padding: 2px 8px;
  border: 1px solid ${Colors.Gray300};
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  background-color: white;
  color: ${Colors.Gray700};

  &:hover {
    background-color: ${Colors.Gray100};
  }
`;

const ResetButton = styled.button`
  padding: 2px 8px;
  border: 1px solid ${Colors.Orange500};
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  background-color: white;
  color: ${Colors.Orange600};

  &:hover {
    background-color: ${Colors.Orange100};
  }
`;
