# GraphQL Mocker

> 🎭 Chrome extension to capture, edit, and mock GraphQL responses in real-time

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<p align="center">
  <img src="docs/demo.gif" alt="GraphQL Mocker Demo" width="600">
</p>

## 🚀 Features

- **📸 Capture GraphQL Responses** - Automatically intercepts and captures all GraphQL requests and responses
- **✏️ Edit Responses** - Intuitive JSON editor with syntax highlighting and tree view
- **🎭 Mock Responses** - Activate custom responses to test edge cases without backend changes
- **🔍 Search & Filter** - Quickly find operations and search through JSON data
- **🪟 Separate Window** - Open a larger editor window for complex data editing
- **💾 Auto-Save** - Your custom responses are automatically saved per tab

## 📦 Installation

### From Chrome Web Store (Recommended)

Coming soon!

### Manual Installation (Development)

1. Clone this repository

```bash
git clone https://github.com/wtdlee/graphql-mocker.git
cd graphql-mocker
```

2. Install dependencies

```bash
yarn install
```

3. Build the extension

```bash
yarn build
```

4. Load the extension in Chrome
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## 🎯 Use Cases

### Testing Edge Cases

Mock error responses, empty states, or extreme data without touching your backend:

```json
{
  "data": {
    "user": null
  },
  "errors": [
    {
      "message": "User not found",
      "extensions": { "code": "NOT_FOUND" }
    }
  ]
}
```

### Frontend Development

Continue developing your frontend even when the backend API is not ready or unstable.

### QA Testing

Quickly test different scenarios without setting up complex backend states:

- Empty lists
- Maximum items
- Various error states
- Loading states
- Permission denied scenarios

### Demo & Presentations

Show different states of your application during demos without complex setup.

## 📖 How It Works

### Architecture

```
┌─────────────┐
│  Web Page   │
│  (GraphQL)  │
└──────┬──────┘
       │ 1. Intercept (fetch/XHR monkey patch)
       ▼
┌─────────────┐
│  appHook.js │ ← Injected into page context
└──────┬──────┘
       │ 2. window.postMessage
       ▼
┌─────────────┐
│  content.js │ ← Content script (bridge)
└──────┬──────┘
       │ 3. chrome.runtime.connect
       ▼
┌─────────────┐
│background.js│ ← Service worker (state manager)
└──────┬──────┘
       │ 4. Storage & sync
       ▼
┌─────────────┐
│  Popup UI   │ ← React UI
└─────────────┘
```

### Key Mechanisms

1. **Monkey Patching**: Overrides native `window.fetch` and `XMLHttpRequest` to intercept GraphQL requests
2. **Message Passing**: Uses `window.postMessage` and `chrome.runtime.connect` to communicate between contexts
3. **Response Mocking**: Returns custom `Response` objects or modifies XHR properties to simulate API responses
4. **Conditional Override**: Only mocks responses when explicitly activated by the user

## 🛠️ Development

### Prerequisites

- Node.js >= 16
- Yarn

### Setup

```bash
# Install dependencies
yarn install

# Development build with watch mode
yarn dev

# Production build
yarn build

# Run linter
yarn lint

# Run tests
yarn test
```

### Project Structure

```
graphql-mocker/
├── src/
│   ├── app/
│   │   ├── appHook.ts       # GraphQL interception logic
│   │   ├── content.ts       # Content script (bridge)
│   │   ├── background.ts    # Background service worker
│   │   └── store.ts         # State management
│   ├── ui/
│   │   ├── app.tsx          # Root component
│   │   ├── popup.tsx        # Popup entry point
│   │   └── components/
│   │       ├── GraphQLList.tsx
│   │       ├── GraphQLEditorWindow.tsx
│   │       └── JSONEditor.tsx
│   └── type/
│       └── type.ts          # TypeScript definitions
├── dist/                    # Build output
├── webpack.config.js
└── manifest.json           # Chrome extension manifest
```

## 📝 Usage Guide

### Basic Usage

1. **Open the extension** - Click the GraphQL Mocker icon in your toolbar
2. **Navigate to your app** - Visit any page that makes GraphQL requests
3. **View captured operations** - Operations will appear automatically in the extension popup
4. **Edit a response**:
   - Click on an operation to expand it
   - Click "Edit Custom" to modify the response
   - Make your changes in the JSON editor
   - Click "Save Changes"
5. **Activate the mock** - Click "Activate" to use your custom response
6. **Reload the page** - Your custom response will be returned instead of the real API response

### Advanced Features

#### Separate Editor Window

For complex responses, click "Open in Window" to get a larger editing area with search functionality.

#### Search in JSON

In the separate window, use the search box to find specific keys or values in large responses.

#### Reset to Original

Click the "Reset" button next to any modified field to restore its original value.

#### Delete Custom Response

Click "Delete Custom" to remove your modifications and return to the original response.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the need for better GraphQL testing tools
- Built with React, TypeScript, and Chrome Extension APIs

## 📧 Support

- 🐛 [Report a bug](https://github.com/wtdlee/graphql-mocker/issues/new?labels=bug)
- 💡 [Request a feature](https://github.com/wtdlee/graphql-mocker/issues/new?labels=enhancement)
- ❓ [Ask a question](https://github.com/wtdlee/graphql-mocker/discussions)

---

Made with ❤️ by [wtdlee](https://github.com/wtdlee)
