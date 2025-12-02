// GraphQL Mocker Design System

// Core palette
const palette = {
  // GraphQL Brand - Magenta/Pink
  magenta: {
    50: '#fdf2f8',
    100: '#fce7f3',
    200: '#fbcfe8',
    300: '#f9a8d4',
    400: '#f472b6',
    500: '#ec4899',
    600: '#db2777',
    700: '#be185d',
    800: '#9d174d',
    900: '#831843',
  },

  // Accent - Cyan for contrast
  cyan: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },

  // Success - Emerald
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
  },

  // Warning - Amber
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Error - Rose
  rose: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
    800: '#9f1239',
    900: '#881337',
  },

  // Neutral - Slate (for dark mode)
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
};

// Dark theme (default for devtools)
export const darkTheme = {
  // Backgrounds
  bg: {
    primary: palette.slate[950],
    secondary: palette.slate[900],
    tertiary: palette.slate[800],
    elevated: palette.slate[800],
    hover: palette.slate[700],
    active: palette.slate[600],
  },

  // Text
  text: {
    primary: palette.slate[50],
    secondary: palette.slate[300],
    tertiary: palette.slate[400],
    muted: palette.slate[500],
    inverse: palette.slate[900],
  },

  // Borders
  border: {
    primary: palette.slate[700],
    secondary: palette.slate[600],
    focus: palette.magenta[500],
  },

  // Brand colors
  brand: {
    primary: palette.magenta[500],
    primaryHover: palette.magenta[400],
    primaryActive: palette.magenta[600],
    secondary: palette.cyan[500],
    secondaryHover: palette.cyan[400],
  },

  // Semantic colors
  semantic: {
    success: palette.emerald[500],
    successBg: palette.emerald[900] + '40',
    warning: palette.amber[500],
    warningBg: palette.amber[900] + '40',
    error: palette.rose[500],
    errorBg: palette.rose[900] + '40',
    info: palette.cyan[500],
    infoBg: palette.cyan[900] + '40',
  },

  // JSON syntax highlighting
  syntax: {
    key: palette.magenta[400],
    string: palette.emerald[400],
    number: palette.cyan[400],
    boolean: palette.amber[400],
    null: palette.slate[500],
    bracket: palette.slate[400],
  },

  // Status badges
  badge: {
    active: palette.emerald[500],
    activeBg: palette.emerald[500] + '20',
    inactive: palette.slate[500],
    inactiveBg: palette.slate[500] + '20',
    custom: palette.magenta[500],
    customBg: palette.magenta[500] + '20',
    mocked: palette.cyan[500],
    mockedBg: palette.cyan[500] + '20',
  },
};

// Light theme (optional)
export const lightTheme = {
  bg: {
    primary: '#ffffff',
    secondary: palette.slate[50],
    tertiary: palette.slate[100],
    elevated: '#ffffff',
    hover: palette.slate[100],
    active: palette.slate[200],
  },

  text: {
    primary: palette.slate[900],
    secondary: palette.slate[600],
    tertiary: palette.slate[500],
    muted: palette.slate[400],
    inverse: '#ffffff',
  },

  border: {
    primary: palette.slate[200],
    secondary: palette.slate[300],
    focus: palette.magenta[500],
  },

  brand: {
    primary: palette.magenta[600],
    primaryHover: palette.magenta[500],
    primaryActive: palette.magenta[700],
    secondary: palette.cyan[600],
    secondaryHover: palette.cyan[500],
  },

  semantic: {
    success: palette.emerald[600],
    successBg: palette.emerald[50],
    warning: palette.amber[600],
    warningBg: palette.amber[50],
    error: palette.rose[600],
    errorBg: palette.rose[50],
    info: palette.cyan[600],
    infoBg: palette.cyan[50],
  },

  syntax: {
    key: palette.magenta[600],
    string: palette.emerald[600],
    number: palette.cyan[600],
    boolean: palette.amber[600],
    null: palette.slate[400],
    bracket: palette.slate[500],
  },

  badge: {
    active: palette.emerald[600],
    activeBg: palette.emerald[100],
    inactive: palette.slate[500],
    inactiveBg: palette.slate[100],
    custom: palette.magenta[600],
    customBg: palette.magenta[100],
    mocked: palette.cyan[600],
    mockedBg: palette.cyan[100],
  },
};

export type Theme = typeof darkTheme;

// Legacy colors export for backward compatibility
const Colors = {
  Primary100: palette.magenta[100],
  Primary200: palette.magenta[200],
  Primary300: palette.magenta[300],
  Primary400: palette.magenta[400],
  Primary500: palette.magenta[500],
  Primary600: palette.magenta[600],
  Primary700: palette.magenta[700],

  Blue100: palette.cyan[100],
  Blue200: palette.cyan[200],
  Blue300: palette.cyan[300],
  Blue400: palette.cyan[400],
  Blue500: palette.cyan[500],
  Blue600: palette.cyan[600],
  Blue700: palette.cyan[700],

  Green100: palette.emerald[100],
  Green200: palette.emerald[200],
  Green300: palette.emerald[300],
  Green400: palette.emerald[400],
  Green500: palette.emerald[500],
  Green600: palette.emerald[600],
  Green700: palette.emerald[700],

  Red100: palette.rose[100],
  Red200: palette.rose[200],
  Red300: palette.rose[300],
  Red400: palette.rose[400],
  Red500: palette.rose[500],
  Red600: palette.rose[600],
  Red700: palette.rose[700],

  Orange100: palette.amber[100],
  Orange200: palette.amber[200],
  Orange300: palette.amber[300],
  Orange400: palette.amber[400],
  Orange500: palette.amber[500],
  Orange600: palette.amber[600],
  Orange700: palette.amber[700],

  Yellow100: palette.amber[100],
  Yellow200: palette.amber[200],
  Yellow300: palette.amber[300],
  Yellow400: palette.amber[400],
  Yellow500: palette.amber[500],
  Yellow600: palette.amber[600],
  Yellow700: palette.amber[700],

  Gray25: palette.slate[50],
  Gray50: palette.slate[100],
  Gray100: palette.slate[200],
  Gray200: palette.slate[300],
  Gray300: palette.slate[400],
  Gray400: palette.slate[500],
  Gray500: palette.slate[600],
  Gray600: palette.slate[700],
  Gray700: palette.slate[800],
  Gray800: palette.slate[900],

  Background: '#ffffff',
  BackgroundDark: palette.slate[950],
};

export default Colors;
