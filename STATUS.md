# 📋 LampChat - Project Status

> Last Updated: November 30, 2024

## 🎯 Project Overview

**LampChat** is an AI chat application inspired by [T3 Chat](https://t3.chat), built to provide a clean, modern interface for interacting with various AI models through the [OpenRouter API](https://openrouter.ai).

### Design Goals
- **T3-style interface** — Closely matches T3 Chat's clean, minimal design
- **Light theme** with black/amber accents (light version of T3 Chat's aesthetic)
- **Modular architecture** for easy feature additions
- **Database-ready** design (currently localStorage, prepared for Neon PostgreSQL)
- **No build step** - vanilla JavaScript with ES modules

---

## ✅ Completed Features

### Core Infrastructure
- [x] **Modular project structure** with clear separation of concerns
- [x] **Repository pattern** for data access (easy database swap)
- [x] **State management** with pub/sub pattern for reactive updates
- [x] **Component system** with lifecycle methods (init, refresh, destroy)

### UI Components
- [x] **Sidebar** (T3-style)
  - Hamburger toggle button for collapsible sidebar
  - "LampChat" branding next to toggle
  - "New Chat" button with rounded corners
  - Minimal search bar (borderless)
  - Chat history grouped by date (Today, Yesterday, Previous 7 Days, Older)
  - Clean thread list with subtle hover states
  - Delete chat functionality
  - User profile fixed at bottom with avatar, name, and settings access

- [x] **Chat Area** (T3-style)
  - Welcome screen with centered "How can I help you?" heading
  - Header hidden in empty state (T3-style)
  - Floating settings icon in top-right corner
  - Quick action pills (Create, Explore, Code, Learn) with subtle fill
  - Suggested prompts as simple text with left accent on hover
  - Message display with user/assistant differentiation
  - Typing indicator during streaming

- [x] **Message Input** (T3-style)
  - Floating card design with shadow
  - Auto-resizing textarea
  - Minimal model selector dropdown with search
  - Web search toggle button
  - **Attach button** (UI ready for file attachments)
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
  - Data: Export/import chats, delete all data
  - Toast notifications on save

### Backend Services
- [x] **OpenRouter API Integration**
  - Streaming responses (token-by-token)
  - Non-streaming fallback
  - Error handling
  - Connection testing

- [x] **Local Storage Repository**
  - Full CRUD for chats
  - Message management
  - User preferences
  - Settings persistence
  - Data export/import

### Styling & UX
- [x] T3-inspired light theme with black/amber accents
- [x] Collapsible sidebar (works on all screen sizes)
- [x] Floating input bar with shadow
- [x] Context-aware header (hidden in empty state)
- [x] Smooth animations (fade-in messages, typing dots)
- [x] Subtle scrollbars (T3-style)
- [x] Markdown rendering with syntax highlighting
- [x] Code block copy buttons
- [x] Responsive design

### Documentation
- [x] Comprehensive README.md
- [x] MIT License
- [x] .gitignore for common files

### Recent Updates (T3 Redesign - Nov 30, 2024)
- [x] **Sidebar redesign** — Added toggle button, narrower width (264px), cleaner styling
- [x] **Header visibility** — Hidden in empty state, floating settings icon instead
- [x] **Welcome screen** — Centered layout, T3-style category pills, simple text prompts
- [x] **Input bar** — Floating card with shadow, attach button, circular send button
- [x] **Visual polish** — Subtle scrollbars, better transitions, cohesive spacing
- [x] **Settings page redesign** — Full-page T3-style with user profile sidebar, keyboard shortcuts, tabbed navigation
- [x] **Model dropdown z-index fix** — Dropdown now appears above input bar correctly

---

## 🚧 Remaining Work

### High Priority
- [ ] **Dark mode toggle** - Add theme switcher in settings
- [ ] **File attachments** - Implement upload logic (Attach button UI already added)
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
- [ ] **Message regeneration** - Regenerate last response
- [ ] **Token counting** - Show token usage per message
- [ ] **Cost tracking** - Track API spending
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
│   ├── openrouter.js # API client with streaming
│   ├── state.js      # Centralized state + pub/sub
│   └── index.js
│
├── components/       # UI Components
│   ├── Sidebar.js    # Navigation, chat list
│   ├── ChatArea.js   # Messages, welcome screen
│   ├── MessageInput.js # Input, model selector
│   ├── Settings.js   # Modal with tabs
│   └── index.js
│
├── utils/            # Utilities
│   ├── dom.js        # DOM manipulation helpers
│   ├── markdown.js   # Markdown + code highlighting
│   ├── date.js       # Date formatting/grouping
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

# Start local server (pick one)
npx serve .
python -m http.server 3000
php -S localhost:3000

# Open http://localhost:3000
```

### First Time Setup
1. App will prompt for API key on first load
2. Go to Settings → API Keys
3. Paste your OpenRouter API key
4. Start chatting!

---

## 📁 File Inventory

| File | Purpose |
|------|---------|
| `index.html` | Entry point, loads Tailwind + libs via CDN |
| `main.js` | App bootstrap, wires components together |
| `src/config/constants.js` | App name, API URLs, storage keys |
| `src/config/models.js` | AI model definitions (easy to add new) |
| `src/repositories/BaseRepository.js` | Data access interface |
| `src/repositories/LocalStorageRepository.js` | localStorage implementation |
| `src/services/openrouter.js` | OpenRouter API client |
| `src/services/state.js` | Global state management |
| `src/components/Sidebar.js` | Left sidebar UI |
| `src/components/ChatArea.js` | Main chat display |
| `src/components/MessageInput.js` | Message input + model selector |
| `src/components/Settings.js` | Full-page settings (T3-style) |
| `src/utils/dom.js` | DOM helper functions |
| `src/utils/markdown.js` | Markdown rendering |
| `src/utils/date.js` | Date grouping utilities |
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
    capabilities: ['vision', 'tools'],
    description: 'Description'
}
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

1. **Model dropdown stays open** - Clicking outside sometimes doesn't close it
2. **No loading state** - Initial app load doesn't show loading indicator
3. **Mobile sidebar** - Needs overlay backdrop when open on mobile
4. **Attach button** - UI only, file upload not yet implemented
5. **Settings page** - Dark mode toggle is placeholder only (coming soon)

---

## 📞 Contact

For questions about this project, reach out to the original developer or open an issue in the repository.

