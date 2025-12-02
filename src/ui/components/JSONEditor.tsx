import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { JsonValue, JsonObject } from '../../type/type';

interface JSONEditorProps {
  data: JsonValue;
  originalData?: JsonValue;
  onChange: (newData: JsonValue) => void;
}

interface FieldEditorProps {
  path: string[];
  value: JsonValue;
  originalValue?: JsonValue;
  onChange: (path: string[], newValue: JsonValue) => void;
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
  const [editValue, setEditValue] = useState('');

  const pathKey = path.join('.');
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isModified =
    originalValue !== undefined && JSON.stringify(value) !== JSON.stringify(originalValue);

  const isBoolean = typeof value === 'boolean';

  const handleStartEdit = () => {
    setEditValue(typeof value === 'string' ? value : JSON.stringify(value));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    try {
      let newValue: JsonValue;
      if (typeof value === 'string') {
        newValue = editValue;
      } else if (typeof value === 'number') {
        newValue = parseFloat(editValue);
      } else if (typeof value === 'boolean') {
        newValue = editValue === 'true';
      } else {
        newValue = JSON.parse(editValue) as JsonValue;
      }
      onChange(path, newValue);
      setIsEditing(false);
    } catch {
      alert('Invalid value format');
    }
  };

  const handleBooleanChange = (newBoolValue: boolean) => {
    onChange(path, newBoolValue);
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
    const valueAsObject: JsonObject = value as JsonObject;
    const valueAsArray: JsonValue[] = value as JsonValue[];
    const entries: [string, JsonValue][] = isObject
      ? Object.entries(valueAsObject)
      : valueAsArray.map((v, i) => [String(i), v]);

    return (
      <FieldContainer>
        <FieldHeader $isModified={isModified}>
          <ExpandButton
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              onToggleExpand(path);
            }}
            $isExpanded={isExpanded}
            type="button"
          />
          <FieldKey>{path[path.length - 1] || 'root'}</FieldKey>
          <FieldType>{isArray ? `Array[${value.length}]` : 'Object'}</FieldType>
          {isModified && (
            <>
              <ModifiedBadge>Modified</ModifiedBadge>
              <ResetButton
                onClick={e => {
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
              const childPathKey = childPath.join('.');
              const childIsExpanded = expandedPaths.has(childPathKey);
              return (
                <FieldEditor
                  key={`${pathKey}.${key}`}
                  path={childPath}
                  value={val}
                  originalValue={
                    originalValue !== undefined
                      ? isArray
                        ? (originalValue as JsonValue[])[parseInt(key)]
                        : (originalValue as JsonObject)[key]
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
      <FieldRow $isModified={isModified}>
        <FieldKey>{path[path.length - 1]}</FieldKey>
        {isBoolean ? (
          <>
            <BooleanSelect
              value={String(value)}
              onChange={e => {
                e.stopPropagation();
                handleBooleanChange(e.target.value === 'true');
              }}
              onClick={e => e.stopPropagation()}
              $value={value === true}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </BooleanSelect>
            <FieldType>boolean</FieldType>
            {isModified && (
              <>
                <ModifiedBadge>Modified</ModifiedBadge>
                <OriginalValue>
                  Original: {typeof originalValue === 'boolean' ? String(originalValue) : 'N/A'}
                </OriginalValue>
                <ResetButton
                  onClick={e => {
                    e.stopPropagation();
                    handleResetToOriginal();
                  }}
                >
                  Reset
                </ResetButton>
              </>
            )}
          </>
        ) : isEditing ? (
          <>
            <ValueInput
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
            <ActionButton
              onClick={e => {
                e.stopPropagation();
                handleSaveEdit();
              }}
            >
              Save
            </ActionButton>
            <ActionButton
              onClick={e => {
                e.stopPropagation();
                handleCancelEdit();
              }}
              $secondary
            >
              Cancel
            </ActionButton>
          </>
        ) : (
          <>
            <FieldValue
              onClick={e => {
                e.stopPropagation();
                handleStartEdit();
              }}
              title="Click to edit"
              $type={typeof value}
            >
              {typeof value === 'string' ? `"${value}"` : String(value)}
            </FieldValue>
            <FieldType>{typeof value}</FieldType>
            {isModified && (
              <>
                <ModifiedBadge>Modified</ModifiedBadge>
                <OriginalValue>
                  Original:{' '}
                  {typeof originalValue === 'string' ||
                  typeof originalValue === 'number' ||
                  typeof originalValue === 'boolean'
                    ? String(originalValue)
                    : originalValue === null
                      ? 'null'
                      : JSON.stringify(originalValue)}
                </OriginalValue>
                <ResetButton
                  onClick={e => {
                    e.stopPropagation();
                    handleResetToOriginal();
                  }}
                >
                  Reset
                </ResetButton>
              </>
            )}
            <EditButton
              onClick={e => {
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

export const JSONEditor: React.FC<JSONEditorProps> = ({ data, originalData, onChange }) => {
  // Initialize with all paths expanded
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const getAllPaths = (obj: JsonValue, currentPath: string[] = ['root']): string[] => {
      const paths: string[] = [currentPath.join('.')];

      if (obj !== null && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            const newPath = [...currentPath, String(index)];
            paths.push(...getAllPaths(item, newPath));
          });
        } else {
          const objRecord: JsonObject = obj;
          Object.entries(objRecord).forEach(([key, value]) => {
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
    const pathKey = path.join('.');
    setExpandedPaths(prev => {
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
    (path: string[], newValue: JsonValue) => {
      const newData = JSON.parse(JSON.stringify(data)) as JsonObject;
      let current = newData;

      // Navigate to the parent
      for (let i = 1; i < path.length - 1; i++) {
        current = current[path[i]] as JsonObject;
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
        path={['root']}
        value={data}
        originalValue={originalData}
        onChange={handleFieldChange}
        isExpanded={expandedPaths.has('root')}
        onToggleExpand={handleToggleExpand}
        expandedPaths={expandedPaths}
      />
    </EditorContainer>
  );
};

// Styled Components with theme from ThemeProvider
const EditorContainer = styled.div`
  width: 100%;
  min-width: 0;
  background: ${props => props.theme.bg.primary};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 8px;
  padding: 16px;
  max-height: 100%;
  overflow: auto;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  font-size: 13px;
  box-sizing: border-box;
`;

const FieldContainer = styled.div`
  margin-left: 16px;
  min-width: 0;
  width: 100%;

  &:first-child {
    margin-left: 0;
  }
`;

const FieldHeader = styled.div<{ $isModified?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin: 2px 0;
  background: ${props => (props.$isModified ? props.theme.semantic.warningBg : 'transparent')};
  border-radius: 4px;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
`;

const FieldRow = styled.div<{ $isModified?: boolean }>`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 8px;
  margin: 2px 0;
  background: ${props => (props.$isModified ? props.theme.semantic.warningBg : 'transparent')};
  border-radius: 4px;
  min-width: 0;
  max-width: 100%;
`;

const ExpandButton = styled.button<{ $isExpanded: boolean }>`
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
  flex-shrink: 0;

  &:hover::after {
    border-left-color: ${props => props.theme.brand.primary};
  }

  &::after {
    content: '';
    display: inline-block;
    width: 0;
    height: 0;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-left: 5px solid ${props => props.theme.text.muted};
    transform: ${props => (props.$isExpanded ? 'rotate(90deg)' : 'rotate(0deg)')};
    transition: transform 0.2s;
  }
`;

const FieldKey = styled.span`
  font-weight: 600;
  color: ${props => props.theme.syntax.key};
  word-break: break-word;
`;

const FieldValue = styled.span<{ $type?: string }>`
  color: ${props => {
    switch (props.$type) {
      case 'string':
        return props.theme.syntax.string;
      case 'number':
        return props.theme.syntax.number;
      case 'boolean':
        return props.theme.syntax.boolean;
      default:
        return props.theme.text.secondary;
    }
  }};
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  word-break: break-all;

  &:hover {
    background: ${props => props.theme.bg.hover};
  }
`;

const FieldType = styled.span`
  color: ${props => props.theme.text.muted};
  font-size: 10px;
  text-transform: uppercase;
`;

const ModifiedBadge = styled.span`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  background: ${props => props.theme.semantic.warning};
  color: ${props => props.theme.text.inverse};
`;

const OriginalValue = styled.span`
  color: ${props => props.theme.text.muted};
  font-size: 11px;
  font-style: italic;
`;

const FieldChildren = styled.div`
  margin-left: 8px;
  border-left: 2px solid ${props => props.theme.border.primary};
  padding-left: 8px;
  min-width: 0;
  width: calc(100% - 16px);
`;

const ValueInput = styled.input`
  flex: 1;
  min-width: 100px;
  padding: 4px 8px;
  background: ${props => props.theme.bg.tertiary};
  border: 2px solid ${props => props.theme.brand.primary};
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  color: ${props => props.theme.text.primary};

  &:focus {
    outline: none;
    border-color: ${props => props.theme.brand.primaryHover};
  }
`;

const BooleanSelect = styled.select<{ $value: boolean }>`
  padding: 4px 8px;
  background: ${props => props.theme.bg.tertiary};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: ${props => props.theme.syntax.boolean};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: ${props => props.theme.brand.primary};
  }

  &:focus {
    outline: none;
    border-color: ${props => props.theme.brand.primary};
  }

  option {
    background: ${props => props.theme.bg.secondary};
    color: ${props => props.theme.text.primary};
  }
`;

const ActionButton = styled.button<{ $secondary?: boolean }>`
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  background: ${props => (props.$secondary ? props.theme.bg.tertiary : props.theme.brand.primary)};
  color: ${props => (props.$secondary ? props.theme.text.secondary : 'white')};
  transition: all 0.2s;

  &:hover {
    background: ${props =>
      props.$secondary ? props.theme.bg.hover : props.theme.brand.primaryHover};
  }
`;

const EditButton = styled.button`
  padding: 2px 8px;
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  background: transparent;
  color: ${props => props.theme.text.muted};
  transition: all 0.2s;

  &:hover {
    background: ${props => props.theme.bg.hover};
    color: ${props => props.theme.text.secondary};
  }
`;

const ResetButton = styled.button`
  padding: 2px 8px;
  border: 1px solid ${props => props.theme.semantic.warning};
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  background: transparent;
  color: ${props => props.theme.semantic.warning};
  transition: all 0.2s;

  &:hover {
    background: ${props => props.theme.semantic.warningBg};
  }
`;
