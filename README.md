# 🔦 LampChat

A modern, full-featured AI chat application inspired by [T3 Chat](https://t3.chat). Built with vanilla JavaScript and a modular architecture, featuring optional cloud sync with user authentication and Neon PostgreSQL.

## ✨ Features

### Core Chat Features

- **Multi-Model Support** — Access 15+ AI models via OpenRouter (GPT-5.1, Claude 4.5, Gemini 3, Grok 4, and more)
- **🖼️ Image Generation** — Generate images with AI models (GPT-5 Image, Gemini 2.5 Flash Image)
- **📎 Multimodal Support** — Attach images and PDFs for vision models to analyze
- **Real-time Streaming** — Optimized streaming responses with no screen flicker
- **Streaming Stats** — View model name, tokens/sec, token count, and time-to-first-token on hover
- **Markdown Rendering** — Full markdown support with syntax-highlighted code blocks
- **Response Actions** — Copy and regenerate buttons on hover for assistant messages

### User Interface

- **T3-Inspired Design** — Clean, minimal interface closely matching T3 Chat's aesthetic
- **Full-Page Settings** — T3-style settings with user profile sidebar and tabbed navigation
- **Model Switching** — Change models mid-conversation with searchable dropdown
- **Floating Input Bar** — Modern floating input with shadow and attach button
- **Collapsible Sidebar** — Smooth animated sidebar with chat list and search
- **Custom Dialogs** — In-app confirmation modals (no browser popups)
- **Responsive Design** — Works on desktop and mobile
- **Clean Light Theme** — Elegant cream/white design with black/amber accents

### Authentication & Cloud Sync

- **Optional User Accounts** — Sign up/login for cloud storage or use locally
- **Neon PostgreSQL Backend** — Cloud database for authenticated users
- **Automatic Data Sync** — Chats and projects sync across devices when logged in
- **JWT Authentication** — Secure token-based authentication with 7-day expiry
- **Data Export/Import** — Export and import all your data

### Projects

- **Project Organization** — Group related chats with custom instructions and knowledge base files
- **Custom Instructions** — System prompts applied to all chats within a project
- **File Attachments** — Upload and manage project-specific files (PDFs, text, etc.) for context
- **Project Dashboard** — Manage project settings, files, and associated chats
- **Visibility Control** — Private projects; shared links planned

### Data & Privacy

- **Dual Storage Modes** — LocalStorage for guests, Neon PostgreSQL for authenticated users
- **Chat History** — Persistent conversations with search and date grouping
- **Privacy-First** — Your API key stays in your browser (guests) or is encrypted server-side (authenticated users)
- **Direct API Calls / Proxy** — Guests call OpenRouter directly; authenticated users proxy through `/api/chat` with server-side key

## 🚀 Quick Start

### Development

```bash
# Clone the repository
git clone https://github.com/AppleLamps/t3-v0.1.git
cd t3-v0.1

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
3. Set the required environment variables (see [Configuration](#️-configuration))
4. Vercel auto-detects Vite and deploys automatically

> Build command: `npm run build` | Output directory: `dist`

### Setup Your API Key

1. Visit [openrouter.ai/keys](https://openrouter.ai/keys) to get your API key
2. Open LampChat in your browser
3. Go to **Settings → API Keys**
4. Paste your OpenRouter API key
5. Start chatting!

## ⚙️ Configuration

### Environment Variables (for Vercel deployment)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Yes (for auth) |
| `JWT_SECRET` | Secret key for JWT token signing | Yes (for auth) |
| `ENCRYPTION_KEY` | 32-char key for encrypting stored API keys (fallback: `JWT_SECRET`) | Recommended |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL for rate limiting | Yes (for rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token | Yes (for rate limiting) |
| `ALLOWED_ORIGINS` | Comma-separated origins allowed for CORS | Recommended |

### Database Setup

1. Create a free [Neon PostgreSQL](https://neon.tech) database
2. Run the schema in `db/schema.sql` to create tables (includes users, chats, messages, projects, and project_files)
3. Add your `DATABASE_URL` to Vercel environment variables

## 📁 Project Structure

```text
lampchat/
├── index.html                  # Entry point (minimal HTML shell)
├── main.js                     # Application bootstrap
├── vercel.json                 # Vercel deployment config
├── package.json                # Dependencies & scripts
│
├── api/                        # Vercel Serverless Functions
│   ├── auth.js                 # Authentication (signup/login/verify/refresh/logout)
│   ├── chat.js                 # Chat proxy for authenticated users (keeps API key server-side)
│   ├── data.js                 # Data operations (CRUD/export/import/settings)
│   ├── controllers/            # Modular handlers for data.js actions
│   ├── lib/
│   │   └── sql.js              # Neon SQL helper + validation
│   └── utils/
│       └── rateLimiter.js      # Rate limiting with Upstash Redis
│
├── db/
│   └── schema.sql              # Neon PostgreSQL schema
│
├── dist/                       # Production build output (Vite)
└── src/
    ├── config/                 # Configuration
    │   ├── constants.js        # App constants & storage keys
    │   ├── models.js           # AI model definitions (15+ models)
    │   └── index.js
    │
    ├── repositories/           # Data Access Layer (Repository Pattern)
    │   ├── BaseRepository.js   # Abstract interface
    │   ├── LocalStorageRepository.js  # Guest mode storage
    │   ├── NeonRepository.js   # Cloud storage for authenticated users
    │   └── index.js            # Dynamic repository factory
    │
    ├── services/               # Business Logic
    │   ├── openrouter.js       # OpenRouter API client with streaming
    │   ├── auth.js             # Authentication service
    │   ├── state.js            # State management (pub/sub)
    │   ├── ChatController.js   # Chat orchestration
    │   └── index.js
    │
    ├── components/             # UI Components
    │   ├── Sidebar.js          # Navigation & chat list
    │   ├── ChatArea.js         # Message display with hover actions
    │   ├── MessageInput.js     # Input & model selector
    │   ├── Settings.js         # Full-page settings (T3-style)
    │   ├── AuthModal.js        # Login/Signup modal
    │   ├── ProjectModal.js     # Modal for creating/editing projects
    │   ├── ProjectDashboard.js # Project management dashboard
    │   ├── chat/               # Chat sub-components
    │   │   ├── MessageRenderer.js
    │   │   ├── PromptSelector.js
    │   │   ├── TypingIndicator.js
    │   │   └── WelcomeScreen.js
    │   ├── input/              # Input sub-components
    │   │   ├── AttachmentManager.js
    │   │   └── ModelSelector.js
    │   └── index.js
    │
    ├── utils/                  # Utilities
    │   ├── dom.js              # DOM helpers + custom confirm dialog
    │   ├── markdown.js         # Markdown rendering
    │   ├── codeRenderer.js     # Code block rendering
    │   ├── date.js             # Date formatting
    │   ├── files.js            # File processing (Base64 conversion)
    │   └── index.js
    │
    ├── style.css               # Global styles entry
    └── styles/
        └── main.css            # Custom styles
```

## 🏗️ Architecture

### Dynamic Repository Pattern

The data layer automatically switches between storage backends based on authentication state:

```javascript
// src/repositories/index.js
import { authService } from '../services/auth.js';

// Automatically selects the appropriate repository:
// - LocalStorageRepository for guest users
// - NeonRepository for authenticated users (includes projects, chats, messages)
export function getRepository() {
    if (authService.isLoggedIn()) {
        return getNeonRepository();
    }
    return getLocalStorageRepository();
}
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

### Proxy Mode for Authenticated Users

For enhanced security, authenticated users' API keys are stored server-side and chat requests are proxied through Vercel serverless functions:

```javascript
// In proxy mode, API key is fetched from database server-side
this.openRouter.setProxyMode(true, jwtToken);
// Client-side API key is cleared for security
this.openRouter.setApiKey('');
```

### Rate Limiting Architecture

Distributed rate limiting prevents abuse using Upstash Redis (per IP):

- chat: 600/min
- data (CRUD/export/import): 300/min
- login: 10/min
- signup: 5/min
- verify: 120/min
- refresh: 30/min
- logout: 60/min

## 🎨 Customization

### Adding a New AI Model

Edit `src/config/models.js`:

```javascript
export const MODELS = [
    {
        id: 'provider/model-name',
        name: 'Display Name',
        provider: 'Provider',
        capabilities: ['vision', 'tools', 'chat'],
        description: 'Model description'
    },
    // ... existing models
];

// For image generation models, add 'image' to capabilities
// and include the model ID in IMAGE_GENERATION_MODELS array:
export const IMAGE_GENERATION_MODELS = [
    'openai/gpt-5-image',
    'openai/gpt-5-image-mini',
    'google/gemini-2.5-flash-image',
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
| **Vite 5** | Build tool & dev server |
| **Tailwind CSS 3** | Styling (with PostCSS) |
| **Neon PostgreSQL** | Cloud database for authenticated users |
| **Vercel Serverless** | API endpoints for auth & data |
| **JWT** | Token-based authentication |
| **DM Sans** | Typography |
| **Highlight.js** | Code syntax highlighting |
| **Marked** | Markdown parsing |
| **DOMPurify** | XSS protection for rendered content |
| **OpenRouter** | AI model access |

## 📦 Dependencies

**Dev Dependencies:**

- [Vite](https://vitejs.dev/) `^5.0.10` — Fast build tool & dev server
- [Tailwind CSS](https://tailwindcss.com/) `^3.4.0` — Utility-first CSS
- [PostCSS](https://postcss.org/) `^8.4.32` — CSS processing
- [Autoprefixer](https://autoprefixer.github.io/) `^10.4.16` — Vendor prefixes

**Runtime Dependencies:**

- [@neondatabase/serverless](https://neon.tech) `^0.10.4` — Neon PostgreSQL client
- [@upstash/redis](https://upstash.com/docs/redis) `^1.35.7` — Distributed rate limiting
- [@upstash/vector](https://upstash.com/docs/vector) `^1.2.2` — Included for future vector features (not currently used)
- [bcryptjs](https://www.npmjs.com/package/bcryptjs) `^2.4.3` — Password hashing
- [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) `^9.0.2` — JWT authentication
- [Highlight.js](https://highlightjs.org/) `^11.9.0` — Code highlighting
- [Marked](https://marked.js.org/) `^11.1.1` — Markdown parser
- [marked-highlight](https://github.com/markedjs/marked-highlight) `^2.2.3` — Syntax highlighting for markdown
- [DOMPurify](https://github.com/cure53/DOMPurify) `^3.3.0` — HTML sanitization

**External (Google Fonts CDN):**

- DM Sans & JetBrains Mono

## 🤖 Available Models

LampChat supports 15+ AI models via OpenRouter:

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-5.1, GPT-5.1 Chat, GPT-5 Image, GPT-5 Image Mini |
| **Anthropic** | Claude Opus 4.5, Claude Sonnet 4.5, Claude Haiku 4.5 |
| **Google** | Gemini 3 Pro (Preview), Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash (Lite), Gemini 2.5 Flash Image |
| **xAI** | Grok 4 (Fast), Grok 4.1 Fast (Free), Grok Code (Fast) |

## 🔐 Privacy & Security

- **API Key Storage**: Your OpenRouter API key is stored in localStorage (guest) or encrypted in Neon (authenticated)
- **Password Security**: Passwords are hashed with bcrypt (10 salt rounds)
- **JWT Tokens**: Secure authentication with 7-day expiry
- **Proxy for Auth Users**: When logged in, chat requests go through `/api/chat` so your API key stays server-side; guests call OpenRouter directly from the browser.
- **Rate Limiting**: Distributed rate limiting with Upstash Redis to prevent abuse
- **No Analytics**: No tracking or data collection
- **XSS Protection**: All rendered content sanitized with DOMPurify

## 🛣️ Roadmap

- [x] ~~Image attachments~~ ✅ **Multimodal support** (images & PDFs)
- [x] ~~Image generation~~ ✅ **AI image generation** with GPT-5 Image, Gemini
- [x] ~~Neon PostgreSQL integration~~ ✅ **Cloud database** for authenticated users
- [x] ~~User authentication~~ ✅ **JWT-based auth** with signup/login
- [x] ~~Project organization~~ ✅ **Projects with custom instructions and file attachments**
- [x] ~~Rate limiting~~ ✅ **Distributed rate limiting** with Upstash Redis
- [ ] Dark mode toggle
- [ ] Chat export (JSON, Markdown)
- [ ] System prompts / personas
- [ ] Stop generation button
- [ ] Chat renaming
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
- Database hosting by [Neon](https://neon.tech)
- Icons from [Heroicons](https://heroicons.com)

---

Made with ☕ and curiosity
