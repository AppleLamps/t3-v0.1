# 📋 LampChat - Project Status

> Last Updated: November 30, 2025 (v0.2 - Multimodal & Image Generation)

## 🎯 Project Overview

**LampChat** is an AI chat application inspired by [T3 Chat](https://t3.chat), built to provide a clean, modern interface for interacting with various AI models through the [OpenRouter API](https://openrouter.ai).

### Design Goals

- **T3-style interface** — Closely matches T3 Chat's clean, minimal design
- **Light theme** with black/amber accents (light version of T3 Chat's aesthetic)
- **Modular architecture** for easy feature additions
- **Database-ready** design (currently localStorage, prepared for Neon PostgreSQL)
- **Vite-powered** — Modern build tooling with fast HMR, ready for Vercel deployment

---

## ✅ Completed Features

### Core Infrastructure

- [x] **Modular project structure** with clear separation of concerns
- [x] **Repository pattern** for data access (easy database swap)
- [x] **State management** with pub/sub pattern for reactive updates
- [x] **Component system** with lifecycle methods (init, refresh, destroy)

### UI Components

- [x] **Sidebar** (T3-style)
  - Animated collapse (0 width when closed, proper layout reflow)
  - "LampChat" branding
  - "New Chat" button with rounded corners
  - Minimal search bar (borderless)
  - Chat history grouped by date (Today, Yesterday, Previous 7 Days, Older)
  - Clean thread list with subtle hover states
  - Delete chat with custom in-app confirmation
  - User profile fixed at bottom with avatar, name, and settings access

- [x] **Chat Area** (T3-style)
  - Welcome screen with centered "How can I help you?" heading
  - Header with sidebar toggle (hidden in empty state)
  - Floating settings icon in top-right corner (empty state)
  - Quick action pills (Create, Explore, Code, Learn) with subtle fill
  - Suggested prompts as simple text with left accent on hover
  - **Clean message display** — No icons/avatars, no bordered containers
  - User messages in black pill bubbles, assistant messages as plain text
  - **Hover actions** on assistant messages: Copy, Regenerate
  - **Streaming stats** on hover: Model name, tokens/sec, token count, time-to-first-token
  - Optimized streaming (no screen flicker, targeted DOM updates)
  - Typing indicator (hides when first token arrives)

- [x] **Message Input** (T3-style)
  - Floating card design with shadow
  - Auto-resizing textarea
  - Minimal model selector dropdown with search
  - Model capability badges (Image, Vision, Fast)
  - Web search toggle button
  - **Attach button** with file picker (images & PDFs)
  - Attachment preview area with thumbnails and remove buttons
  - Circular amber send button (T3-style)

- [x] **Settings Page** (T3-style full-page)
  - Two-column layout: user profile sidebar + content area
  - Left sidebar: Avatar, name, plan badge, usage stats, keyboard shortcuts
  - Tab navigation: Account, Customization, Models, API Keys, Data
  - "← Back to Chat" header with dark mode toggle placeholder
  - Account: Name customization with Danger Zone
  - Customization: Theme toggles (coming soon)
  - API Keys: OpenRouter key with show/hide toggle, security notice
  - Models: Default model selector, available models with checkboxes
  - Data: Export/import chats, delete all data with custom confirmation
  - Toast notifications on save

- [x] **Custom Confirmation Dialogs**
  - In-app modal instead of browser `confirm()`
  - Styled to match app theme
  - Danger mode (red button) for destructive actions
  - Click outside or Escape to cancel

### Backend Services

- [x] **OpenRouter API Integration**
  - Streaming responses (token-by-token)
  - **Usage accounting** — Fetches token stats from API
  - **Timing stats** — Calculates time-to-first-token, tokens/sec
  - Non-streaming fallback
  - Error handling
  - Connection testing

- [x] **🖼️ Image Generation**
  - Support for image generation models (GPT-5 Image, Gemini Image)
  - Non-streaming image generation for reliable image delivery
  - Base64 image rendering in chat
  - Model capability badges (Image, Vision) in model selector
  - Automatic detection of image generation models

- [x] **📎 Multimodal Support (Vision & PDFs)**
  - File attachment system with image/PDF support
  - Thumbnail previews for attached images
  - PDF icon display for document attachments
  - Base64 encoding for API transmission
  - Attachment preview area with remove buttons
  - Support for multiple file attachments per message

- [x] **Local Storage Repository**
  - Full CRUD for chats
  - Message management with stats storage
  - User preferences
  - Settings persistence
  - Data export/import

### Styling & UX

- [x] T3-inspired light theme with black/amber accents
- [x] Animated collapsible sidebar (proper width collapse)
- [x] Floating input bar with shadow
- [x] Context-aware header (hidden in empty state)
- [x] Smooth animations (fade-in messages, typing dots)
- [x] Subtle scrollbars (T3-style)
- [x] Markdown rendering with syntax highlighting
- [x] Code block copy buttons
- [x] Responsive design
- [x] No screen flicker during streaming

### Documentation

- [x] Comprehensive README.md
- [x] Detailed STATUS.md
- [x] MIT License
- [x] .gitignore for common files

---

## 🚧 Remaining Work

### High Priority

- [ ] **Dark mode toggle** - Add theme switcher in settings
- [x] ~~**File attachments**~~ ✅ Implemented with multimodal support
- [x] ~~**Image generation**~~ ✅ Implemented with GPT-5 Image & Gemini models
- [ ] **System prompts** - Custom instructions/personas per chat
- [ ] **Chat renaming** - Click to edit chat title in sidebar
- [ ] **Stop generation** - Button to cancel streaming response

### Medium Priority

- [ ] **Neon PostgreSQL integration**
  - Create `NeonRepository.js` implementing `BaseRepository`
  - Add connection configuration
  - Migration scripts for schema
  
- [ ] **User authentication**
  - Login/signup flow
  - Session management
  - Per-user data isolation

- [ ] **Chat sharing**
  - Generate shareable links
  - Public/private toggle
  - Read-only shared view

### Low Priority / Nice to Have

- [ ] **Keyboard shortcuts** (Ctrl+K search, Ctrl+N new chat, etc.)
- [ ] **Message editing** - Edit sent messages
- [ ] **Chat folders** - Organize chats into folders
- [ ] **Pinned chats** - Pin important conversations
- [ ] **Chat export** - Export as Markdown, PDF
- [ ] **Import from other apps** - Import ChatGPT, Claude exports
- [ ] **Voice input** - Speech-to-text
- [ ] **Text-to-speech** - Read responses aloud

---

## 🏗️ Architecture Overview

```
src/
├── config/           # Configuration & constants
│   ├── constants.js  # App-wide constants, storage keys
│   ├── models.js     # AI model definitions
│   └── index.js      # Barrel export
│
├── repositories/     # Data Access Layer
│   ├── BaseRepository.js       # Abstract interface (contract)
│   ├── LocalStorageRepository.js  # Current implementation
│   └── index.js                # Factory pattern for swapping
│
├── services/         # Business Logic
│   ├── openrouter.js # API client with streaming + stats
│   ├── state.js      # Centralized state + pub/sub
│   └── index.js
│
├── components/       # UI Components
│   ├── Sidebar.js    # Navigation, chat list
│   ├── ChatArea.js   # Messages, hover actions, streaming
│   ├── MessageInput.js # Input, model selector
│   ├── Settings.js   # Full-page settings
│   └── index.js
│
├── utils/            # Utilities
│   ├── dom.js        # DOM helpers + showConfirm()
│   ├── markdown.js   # Markdown + code highlighting
│   ├── date.js       # Date formatting/grouping
│   ├── files.js      # File processing (Base64 conversion)
│   └── index.js
│
└── styles/
    └── main.css      # Custom styles (non-Tailwind)
```

### Key Design Decisions

1. **Repository Pattern**: All data access goes through `BaseRepository` interface. To switch from localStorage to Neon:

   ```javascript
   // src/repositories/index.js
   const REPOSITORY_TYPE = 'neon'; // Change from 'localStorage'
   ```

2. **State Management**: Single source of truth with reactive updates:

   ```javascript
   stateManager.subscribe('chatUpdated', (state, chat) => {
       // React to changes
   });
   ```

3. **Component Isolation**: Each component manages its own DOM, events, and subscriptions. Communication via handlers:

   ```javascript
   sidebar.setHandlers({
       onNewChat: () => stateManager.createChat(),
       onSelectChat: (id) => stateManager.selectChat(id),
   });
   ```

4. **Optimized Streaming**: During streaming, only the active message element is updated (no full DOM rebuild).

---

## 🚀 Getting Started

### Prerequisites

- Modern browser with ES modules support
- OpenRouter API key ([get one here](https://openrouter.ai/keys))

### Running Locally

```bash
# Clone the repo
git clone <repo-url>
cd lampchat

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### First Time Setup

1. App will prompt for API key on first load
2. Go to Settings → API Keys
3. Paste your OpenRouter API key
4. Start chatting!

---

## 📁 File Inventory

| File | Purpose |
|------|----------|
| `index.html` | Entry point (Vite HTML entry) |
| `main.js` | App bootstrap, imports CSS, wires components |
| `package.json` | NPM dependencies and scripts |
| `vite.config.js` | Vite build configuration |
| `tailwind.config.js` | Tailwind theme customization |
| `postcss.config.js` | PostCSS plugins (Tailwind, Autoprefixer) |
| `src/style.css` | Main CSS entry (Tailwind directives + imports) |
| `src/config/constants.js` | App name, API URLs, storage keys |
| `src/config/models.js` | AI model definitions (easy to add new) |
| `src/repositories/BaseRepository.js` | Data access interface |
| `src/repositories/LocalStorageRepository.js` | localStorage implementation |
| `src/services/openrouter.js` | OpenRouter API client with streaming stats |
| `src/services/state.js` | Global state management |
| `src/components/Sidebar.js` | Left sidebar UI |
| `src/components/ChatArea.js` | Chat display with hover actions |
| `src/components/MessageInput.js` | Message input + model selector |
| `src/components/Settings.js` | Full-page settings (T3-style) |
| `src/utils/dom.js` | DOM helpers + showConfirm() |
| `src/utils/markdown.js` | Markdown rendering |
| `src/utils/date.js` | Date grouping utilities |
| `src/utils/files.js` | File processing (Base64 conversion) |
| `src/styles/main.css` | Custom CSS (scrollbars, animations) |

---

## 🔧 Adding Features

### Adding a New AI Model

Edit `src/config/models.js`:

```javascript
{
    id: 'provider/model-id',
    name: 'Display Name',
    provider: 'Provider',
    capabilities: ['vision', 'tools'],  // Add 'image' for image generation models
    description: 'Description'
}

// For image generation models, also add to IMAGE_GENERATION_MODELS array:
export const IMAGE_GENERATION_MODELS = [
    'openai/gpt-5-image',
    'openai/gpt-5-image-mini',
    'google/gemini-2.5-flash-preview-image-generation',
];
```

### Adding a New Settings Tab

1. Add tab button in `Settings.js` `_render()` method (in the `#settingsTabs` div)
2. Add case in `_renderTabContent()` switch statement
3. Add button handlers in `_bindTabButtons()` method

### Migrating to Neon Database

1. Create `src/repositories/NeonRepository.js`:

```javascript
import { BaseRepository } from './BaseRepository.js';
import { neon } from '@neondatabase/serverless';

export class NeonRepository extends BaseRepository {
    constructor(connectionString) {
        super();
        this.sql = neon(connectionString);
    }
    
    async getChats(userId) {
        return this.sql`SELECT * FROM chats WHERE user_id = ${userId} ORDER BY updated_at DESC`;
    }
    // ... implement other methods
}
```

2. Update `src/repositories/index.js`:

```javascript
import { NeonRepository } from './NeonRepository.js';
const REPOSITORY_TYPE = 'neon';

function createRepository() {
    if (REPOSITORY_TYPE === 'neon') {
        return new NeonRepository(process.env.DATABASE_URL);
    }
    return new LocalStorageRepository();
}
```

---

## 🐛 Known Issues

1. **No loading state** - Initial app load doesn't show loading indicator
2. **Mobile sidebar** - Needs overlay backdrop when open on mobile
3. ~~**Attach button**~~ ✅ Fixed - File attachments now fully functional
4. **Settings page** - Dark mode toggle is placeholder only (coming soon)
5. **Large files** - No file size limit validation (could cause issues with very large images/PDFs)

---

## 📞 Contact

For questions about this project, reach out to the original developer or open an issue in the repository.
