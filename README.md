# 🔦 LampChat

A modern, lightweight AI chat application inspired by [T3 Chat](https://t3.chat). Built with vanilla JavaScript and a modular architecture designed for easy customization and database migration.

![LampChat Screenshot](https://via.placeholder.com/800x450?text=LampChat+Screenshot)

## ✨ Features

- **Multi-Model Support** — Access 15+ AI models via OpenRouter (GPT-4, Claude, Gemini, Llama, and more)
- **Real-time Streaming** — Watch responses appear token-by-token
- **Markdown Rendering** — Full markdown support with syntax-highlighted code blocks
- **Chat History** — Persistent conversations with search and organization
- **Model Switching** — Change models mid-conversation
- **Clean Light Theme** — Elegant design with black accents
- **Responsive Design** — Works on desktop and mobile
- **Privacy-First** — Your API key stays in your browser

## 🚀 Quick Start

### Option 1: Using a Local Server (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/lampchat.git
cd lampchat

# Start a local server (choose one)
npx serve .                    # Using serve
python -m http.server 3000     # Using Python
php -S localhost:3000          # Using PHP
```

### Option 2: Direct File Opening

> ⚠️ Some browsers block ES modules when opening files directly. Use a local server for best results.

### Setup Your API Key

1. Visit [openrouter.ai/keys](https://openrouter.ai/keys) to get your API key
2. Open LampChat in your browser
3. Go to **Settings → API Keys**
4. Paste your OpenRouter API key
5. Start chatting!

## 📁 Project Structure

```
lampchat/
├── index.html                  # Entry point (minimal HTML shell)
├── main.js                     # Application bootstrap
├── README.md
├── .gitignore
│
└── src/
    ├── config/                 # Configuration
    │   ├── constants.js        # App constants & storage keys
    │   ├── models.js           # AI model definitions
    │   └── index.js
    │
    ├── repositories/           # Data Access Layer
    │   ├── BaseRepository.js   # Abstract interface
    │   ├── LocalStorageRepository.js
    │   └── index.js            # Factory (swap implementations here)
    │
    ├── services/               # Business Logic
    │   ├── openrouter.js       # OpenRouter API client
    │   ├── state.js            # State management (pub/sub)
    │   └── index.js
    │
    ├── components/             # UI Components
    │   ├── Sidebar.js          # Navigation & chat list
    │   ├── ChatArea.js         # Message display
    │   ├── MessageInput.js     # Input & model selector
    │   ├── Settings.js         # Settings modal
    │   └── index.js
    │
    ├── utils/                  # Utilities
    │   ├── dom.js              # DOM helpers
    │   ├── markdown.js         # Markdown rendering
    │   ├── date.js             # Date formatting
    │   └── index.js
    │
    └── styles/
        └── main.css            # Custom styles
```

## 🏗️ Architecture

### Repository Pattern

The data layer uses a repository pattern, making database migration straightforward:

```javascript
// src/repositories/index.js

// Current: LocalStorage
const REPOSITORY_TYPE = 'localStorage';

// Future: Change to use Neon PostgreSQL
const REPOSITORY_TYPE = 'neon';
```

**To migrate to Neon Database:**

1. Create `src/repositories/NeonRepository.js`:
```javascript
import { BaseRepository } from './BaseRepository.js';

export class NeonRepository extends BaseRepository {
    constructor(connectionString) {
        super();
        // Initialize Neon client
    }
    
    async getChats(userId) {
        // SQL: SELECT * FROM chats WHERE user_id = $1
    }
    
    // Implement remaining methods...
}
```

2. Update the factory in `src/repositories/index.js`

### State Management

Centralized state with reactive updates:

```javascript
import { stateManager } from './services/state.js';

// Subscribe to changes
const unsubscribe = stateManager.subscribe('chatUpdated', (state, chat) => {
    console.log('Chat updated:', chat);
});

// Modify state
await stateManager.updateSettings({ selectedModel: 'anthropic/claude-3.5-sonnet' });

// Cleanup
unsubscribe();
```

### Component Lifecycle

Each component follows a consistent pattern:

```javascript
class MyComponent {
    init(containerId) {
        // Render HTML, cache elements, bind events
    }
    
    setHandlers(handlers) {
        // Connect to external event handlers
    }
    
    refresh() {
        // Update UI from state
    }
    
    destroy() {
        // Cleanup subscriptions
    }
}
```

## 🎨 Customization

### Adding a New AI Model

Edit `src/config/models.js`:

```javascript
export const MODELS = [
    // Add your model
    {
        id: 'provider/model-name',
        name: 'Display Name',
        provider: 'Provider',
        capabilities: ['vision', 'tools', 'reasoning'],
        description: 'Model description'
    },
    // ... existing models
];
```

### Changing the Theme

Edit `tailwind.config` in `index.html`:

```javascript
tailwind.config = {
    theme: {
        extend: {
            colors: {
                lamp: {
                    bg: '#FAFAF8',        // Background
                    sidebar: '#F3F2EF',   // Sidebar background
                    card: '#FFFFFF',       // Card background
                    border: '#E8E6E1',     // Borders
                    text: '#1A1A1A',       // Primary text
                    muted: '#6B6B6B',      // Muted text
                    accent: '#1A1A1A',     // Accent color (buttons)
                    hover: '#2A2A2A',      // Hover state
                    input: '#F7F7F5',      // Input background
                }
            }
        }
    }
}
```

### Adding a New Component

1. Create `src/components/MyComponent.js`
2. Export from `src/components/index.js`
3. Initialize in `main.js`

## 🔧 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Vanilla JS** | Core application (ES Modules) |
| **Tailwind CSS** | Styling (CDN) |
| **DM Sans** | Typography |
| **Highlight.js** | Code syntax highlighting |
| **Marked.js** | Markdown parsing |
| **OpenRouter** | AI model access |

## 📦 Dependencies

All dependencies are loaded via CDN — no npm install required:

- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [Highlight.js](https://highlightjs.org/) — Code highlighting
- [Marked](https://marked.js.org/) — Markdown parser
- [Google Fonts](https://fonts.google.com/) — DM Sans & JetBrains Mono

## 🔐 Privacy & Security

- **API Key Storage**: Your OpenRouter API key is stored only in your browser's localStorage
- **No Backend**: The app runs entirely in your browser
- **Direct API Calls**: Messages go directly to OpenRouter, not through any intermediary
- **No Analytics**: No tracking or data collection

## 🛣️ Roadmap

- [ ] Dark mode toggle
- [ ] Chat export (JSON, Markdown)
- [ ] Image attachments
- [ ] System prompts / personas
- [ ] Neon PostgreSQL integration
- [ ] User authentication
- [ ] Chat sharing

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [T3 Chat](https://t3.chat)
- AI models provided by [OpenRouter](https://openrouter.ai)
- Icons from [Heroicons](https://heroicons.com)

---

<p align="center">
  Made with ☕ and curiosity
</p>
