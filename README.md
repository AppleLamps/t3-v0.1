# 🔦 LampChat

A modern, lightweight AI chat application inspired by [T3 Chat](https://t3.chat). Built with vanilla JavaScript and a modular architecture designed for easy customization and database migration.

![LampChat Screenshot](https://via.placeholder.com/800x450?text=LampChat+Screenshot)

## ✨ Features

- **T3-Inspired Design** — Clean, minimal interface closely matching T3 Chat's aesthetic
- **Clean Message UI** — No cluttered icons or borders, just clean flowing text
- **Response Actions** — Copy and regenerate buttons on hover for assistant messages
- **Streaming Stats** — View model name, tokens/sec, token count, and time-to-first-token on hover
- **Full-Page Settings** — T3-style settings with user profile sidebar and tabbed navigation
- **Multi-Model Support** — Access 15+ AI models via OpenRouter (GPT-5, Claude, Gemini, Grok, and more)
- **Real-time Streaming** — Optimized streaming with no screen flicker
- **Markdown Rendering** — Full markdown support with syntax-highlighted code blocks
- **Chat History** — Persistent conversations with search and date grouping
- **Model Switching** — Change models mid-conversation with searchable dropdown
- **Floating Input Bar** — Modern floating input with shadow and attach button
- **Clean Light Theme** — Elegant cream/white design with black/amber accents
- **Collapsible Sidebar** — Smooth animated sidebar that properly collapses
- **Custom Dialogs** — In-app confirmation modals (no browser popups)
- **Responsive Design** — Works on desktop and mobile
- **Privacy-First** — Your API key stays in your browser

## 🚀 Quick Start

### Development

```bash
# Clone the repository
git clone https://github.com/yourusername/lampchat.git
cd lampchat

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Deploy to Vercel

1. Push your code to GitHub
2. Connect the repo to [Vercel](https://vercel.com)
3. Vercel auto-detects Vite and deploys automatically

> Build command: `npm run build` | Output directory: `dist`

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
├── STATUS.md                   # Detailed project status
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
    │   ├── openrouter.js       # OpenRouter API client with streaming stats
    │   ├── state.js            # State management (pub/sub)
    │   └── index.js
    │
    ├── components/             # UI Components
    │   ├── Sidebar.js          # Navigation & chat list
    │   ├── ChatArea.js         # Message display with hover actions
    │   ├── MessageInput.js     # Input & model selector
    │   ├── Settings.js         # Full-page settings (T3-style)
    │   └── index.js
    │
    ├── utils/                  # Utilities
    │   ├── dom.js              # DOM helpers + custom confirm dialog
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

### State Management

Centralized state with reactive updates:

```javascript
import { stateManager } from './services/state.js';

// Subscribe to changes
const unsubscribe = stateManager.subscribe('chatUpdated', (state, chat) => {
    console.log('Chat updated:', chat);
});

// Modify state
await stateManager.updateSettings({ selectedModel: 'anthropic/claude-opus-4.5' });

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

Edit `tailwind.config.js`:

```javascript
export default {
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

## 🔧 Tech Stack

| Technology | Purpose |
|------------|----------|
| **Vanilla JS** | Core application (ES Modules) |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Styling (with PostCSS) |
| **DM Sans** | Typography |
| **Highlight.js** | Code syntax highlighting |
| **Marked** | Markdown parsing |
| **OpenRouter** | AI model access |

## 📦 Dependencies

**Dev Dependencies:**

- [Vite](https://vitejs.dev/) — Fast build tool & dev server
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [PostCSS](https://postcss.org/) — CSS processing
- [Autoprefixer](https://autoprefixer.github.io/) — Vendor prefixes

**Runtime Dependencies:**

- [Highlight.js](https://highlightjs.org/) — Code highlighting
- [Marked](https://marked.js.org/) — Markdown parser

**External (Google Fonts CDN):**

- DM Sans & JetBrains Mono

## 🔐 Privacy & Security

- **API Key Storage**: Your OpenRouter API key is stored only in your browser's localStorage
- **No Backend**: The app runs entirely in your browser
- **Direct API Calls**: Messages go directly to OpenRouter, not through any intermediary
- **No Analytics**: No tracking or data collection

## 🛣️ Roadmap

- [ ] Dark mode toggle
- [ ] Chat export (JSON, Markdown)
- [ ] Image attachments (Attach button UI ready)
- [ ] System prompts / personas
- [ ] Stop generation button
- [ ] Chat renaming
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
