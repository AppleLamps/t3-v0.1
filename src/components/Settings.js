// Settings Page Component (T3-Style)
// ===================================

import { stateManager } from '../services/state.js';
import { $, setHtml, showConfirm } from '../utils/dom.js';
import { MODELS } from '../config/models.js';
import { APP_NAME } from '../config/constants.js';

/**
 * Settings page component - T3-style full page settings
 */
export class Settings {
    constructor() {
        this.elements = {
            page: null,
            tabs: null,
            content: null,
        };

        this._activeTab = 'account';
        this._unsubscribers = [];
    }

    /**
     * Initialize the settings page
     * @param {string} containerId - Container element ID
     */
    init(containerId) {
        const container = $(containerId);
        if (!container) {
            console.error('Settings container not found');
            return;
        }

        container.innerHTML = this._render();
        this._cacheElements();
        this._bindEvents();
    }

    /**
     * Render settings page HTML
     * @private
     */
    _render() {
        const user = stateManager.user;
        const userName = user?.name || 'User';
        const userInitial = userName.charAt(0).toUpperCase();

        return `
            <div id="settingsPage" class="hidden fixed inset-0 z-50 bg-lamp-bg overflow-hidden">
                <!-- Settings Header -->
                <header class="h-14 border-b border-lamp-border flex items-center justify-between px-6 bg-lamp-card">
                    <button id="settingsBackBtn" class="flex items-center gap-2 text-lamp-muted hover:text-lamp-text transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                        </svg>
                        <span class="text-sm font-medium">Back to Chat</span>
                    </button>
                    <div class="flex items-center gap-3">
                        <button id="themeToggleBtn" class="p-2 hover:bg-lamp-input rounded-lg transition-colors" title="Toggle theme (coming soon)">
                            <svg class="w-5 h-5 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                            </svg>
                        </button>
                    </div>
                </header>
                
                <!-- Settings Content -->
                <div class="flex h-[calc(100vh-3.5rem)] overflow-hidden">
                    <!-- Left Sidebar - User Profile -->
                    <aside class="w-72 border-r border-lamp-border bg-lamp-card p-6 overflow-y-auto flex flex-col">
                        <!-- Profile Section -->
                        <div class="text-center mb-6">
                            <div class="w-24 h-24 mx-auto bg-gradient-to-br from-teal-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4">
                                <span id="settingsUserInitial">${userInitial}</span>
                            </div>
                            <h2 id="settingsUserName" class="text-xl font-semibold">${userName}</h2>
                            <p class="text-sm text-lamp-muted mt-1">Local User</p>
                            <span class="inline-block mt-2 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Free Plan</span>
                        </div>
                        
                        <!-- Usage Stats (Placeholder) -->
                        <div class="border-t border-lamp-border pt-4 mb-6">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm font-medium">Message Usage</span>
                                <span class="text-xs text-lamp-muted">Local Storage</span>
                            </div>
                            
                            <div class="mb-4">
                                <div class="flex justify-between text-sm mb-1">
                                    <span class="text-lamp-muted">Chats</span>
                                    <span id="settingsChatCount">0</span>
                                </div>
                                <div class="h-1.5 bg-lamp-input rounded-full overflow-hidden">
                                    <div class="h-full bg-amber-500 rounded-full" style="width: 10%"></div>
                                </div>
                                <p class="text-xs text-lamp-muted mt-1">Unlimited local storage</p>
                            </div>
                        </div>
                        
                        <!-- Keyboard Shortcuts -->
                        <div class="border-t border-lamp-border pt-4 mt-auto">
                            <h3 class="text-sm font-medium mb-3">Keyboard Shortcuts</h3>
                            <div class="space-y-2 text-sm">
                                <div class="flex items-center justify-between">
                                    <span class="text-lamp-muted">Search</span>
                                    <div class="flex gap-1">
                                        <kbd class="px-2 py-0.5 bg-lamp-input border border-lamp-border rounded text-xs">Ctrl</kbd>
                                        <kbd class="px-2 py-0.5 bg-lamp-input border border-lamp-border rounded text-xs">K</kbd>
                                    </div>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-lamp-muted">New Chat</span>
                                    <div class="flex gap-1">
                                        <kbd class="px-2 py-0.5 bg-lamp-input border border-lamp-border rounded text-xs">Ctrl</kbd>
                                        <kbd class="px-2 py-0.5 bg-lamp-input border border-lamp-border rounded text-xs">Shift</kbd>
                                        <kbd class="px-2 py-0.5 bg-lamp-input border border-lamp-border rounded text-xs">O</kbd>
                                    </div>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-lamp-muted">Toggle Sidebar</span>
                                    <div class="flex gap-1">
                                        <kbd class="px-2 py-0.5 bg-lamp-input border border-lamp-border rounded text-xs">Ctrl</kbd>
                                        <kbd class="px-2 py-0.5 bg-lamp-input border border-lamp-border rounded text-xs">B</kbd>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                    
                    <!-- Right Content Area -->
                    <main class="flex-1 overflow-y-auto">
                        <!-- Tab Navigation -->
                        <div class="sticky top-0 bg-lamp-bg border-b border-lamp-border px-8 pt-6">
                            <div id="settingsTabs" class="flex gap-1">
                                <button data-tab="account" class="settings-tab px-4 py-2 text-sm font-medium rounded-lg bg-lamp-card border border-lamp-border">Account</button>
                                <button data-tab="customization" class="settings-tab px-4 py-2 text-sm font-medium rounded-lg text-lamp-muted hover:text-lamp-text hover:bg-lamp-card/50 transition-colors">Customization</button>
                                <button data-tab="models" class="settings-tab px-4 py-2 text-sm font-medium rounded-lg text-lamp-muted hover:text-lamp-text hover:bg-lamp-card/50 transition-colors">Models</button>
                                <button data-tab="api" class="settings-tab px-4 py-2 text-sm font-medium rounded-lg text-lamp-muted hover:text-lamp-text hover:bg-lamp-card/50 transition-colors">API Keys</button>
                                <button data-tab="data" class="settings-tab px-4 py-2 text-sm font-medium rounded-lg text-lamp-muted hover:text-lamp-text hover:bg-lamp-card/50 transition-colors">Data</button>
                            </div>
                        </div>
                        
                        <!-- Tab Content -->
                        <div id="settingsContent" class="p-8 max-w-3xl">
                            <!-- Content will be rendered based on active tab -->
                        </div>
                    </main>
                </div>
            </div>
        `;
    }

    /**
     * Cache element references
     * @private
     */
    _cacheElements() {
        this.elements.page = $('settingsPage');
        this.elements.backBtn = $('settingsBackBtn');
        this.elements.tabs = $('settingsTabs');
        this.elements.content = $('settingsContent');
        this.elements.userInitial = $('settingsUserInitial');
        this.elements.userName = $('settingsUserName');
        this.elements.chatCount = $('settingsChatCount');
    }

    /**
     * Bind event handlers
     * @private
     */
    _bindEvents() {
        // Back button
        this.elements.backBtn?.addEventListener('click', () => this.close());

        // Tab switching
        this.elements.tabs?.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-tab]');
            if (tab) {
                this._switchTab(tab.dataset.tab);
            }
        });

        // Theme toggle (placeholder)
        $('themeToggleBtn')?.addEventListener('click', () => {
            alert('Dark mode coming soon!');
        });

        // API key visibility toggle (delegated)
        this.elements.content?.addEventListener('click', (e) => {
            if (e.target.closest('#toggleApiKeyBtn')) {
                this._toggleApiKeyVisibility();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.elements.page?.classList.contains('hidden')) {
                this.close();
            }
        });
    }

    /**
     * Open the settings page
     */
    open() {
        // Update user info
        this._updateUserInfo();
        this._updateChatCount();

        this.elements.page?.classList.remove('hidden');
        this._switchTab('account');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close the settings page
     */
    close() {
        this.elements.page?.classList.add('hidden');
        document.body.style.overflow = '';
    }

    /**
     * Update user info display
     * @private
     */
    _updateUserInfo() {
        const user = stateManager.user;
        const userName = user?.name || 'User';
        const userInitial = userName.charAt(0).toUpperCase();

        if (this.elements.userName) {
            this.elements.userName.textContent = userName;
        }
        if (this.elements.userInitial) {
            this.elements.userInitial.textContent = userInitial;
        }
    }

    /**
     * Update chat count display
     * @private
     */
    _updateChatCount() {
        const chats = stateManager.allChats;
        if (this.elements.chatCount) {
            this.elements.chatCount.textContent = chats.length;
        }
    }

    /**
     * Switch active tab
     * @private
     */
    _switchTab(tab) {
        this._activeTab = tab;

        // Update tab buttons
        this.elements.tabs?.querySelectorAll('.settings-tab').forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.classList.add('bg-lamp-card', 'border', 'border-lamp-border');
                btn.classList.remove('text-lamp-muted', 'hover:text-lamp-text', 'hover:bg-lamp-card/50');
            } else {
                btn.classList.remove('bg-lamp-card', 'border', 'border-lamp-border');
                btn.classList.add('text-lamp-muted', 'hover:text-lamp-text', 'hover:bg-lamp-card/50');
            }
        });

        // Render content
        this._renderTabContent(tab);
    }

    /**
     * Render tab content
     * @private
     */
    _renderTabContent(tab) {
        const user = stateManager.user;
        const settings = stateManager.settings;

        let html = '';

        switch (tab) {
            case 'account':
                html = `
                    <!-- Account Settings -->
                    <section class="mb-8">
                        <h2 class="text-xl font-semibold mb-6">Account Settings</h2>
                        
                        <div class="bg-lamp-card border border-lamp-border rounded-xl p-6 mb-6">
                            <label class="block text-sm font-medium mb-2">Your Name</label>
                            <input type="text" id="settingsName" placeholder="Enter your name" 
                                value="${user?.name || ''}"
                                class="w-full px-4 py-2.5 bg-lamp-input border border-lamp-border rounded-lg focus:outline-none focus:border-lamp-accent transition-colors">
                            <p class="text-xs text-lamp-muted mt-2">This will be used to personalize your experience</p>
                            
                            <button id="saveNameBtn" class="mt-4 px-4 py-2 bg-lamp-accent text-white rounded-lg hover:bg-lamp-hover transition-colors">
                                Save Name
                            </button>
                        </div>
                    </section>
                    
                    <!-- Danger Zone -->
                    <section>
                        <h2 class="text-xl font-semibold mb-4 text-red-600">Danger Zone</h2>
                        <div class="bg-lamp-card border border-red-200 rounded-xl p-6">
                            <p class="text-sm text-lamp-muted mb-4">Permanently delete all your chat history and reset settings. This action cannot be undone.</p>
                            <button id="deleteAllBtn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                                Delete All Data
                            </button>
                        </div>
                    </section>
                `;
                break;

            case 'customization':
                html = `
                    <section class="mb-8">
                        <h2 class="text-xl font-semibold mb-6">Customization</h2>
                        
                        <div class="bg-lamp-card border border-lamp-border rounded-xl p-6 mb-6">
                            <h3 class="font-medium mb-4">Appearance</h3>
                            
                            <div class="flex items-center justify-between py-3 border-b border-lamp-border">
                                <div>
                                    <p class="font-medium">Dark Mode</p>
                                    <p class="text-sm text-lamp-muted">Switch between light and dark theme</p>
                                </div>
                                <div class="flex items-center gap-2 text-lamp-muted">
                                    <span class="text-sm">Coming soon</span>
                                    <div class="w-10 h-6 bg-lamp-input rounded-full relative">
                                        <div class="w-4 h-4 bg-lamp-muted rounded-full absolute left-1 top-1"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex items-center justify-between py-3">
                                <div>
                                    <p class="font-medium">Compact Mode</p>
                                    <p class="text-sm text-lamp-muted">Reduce spacing for more content</p>
                                </div>
                                <div class="flex items-center gap-2 text-lamp-muted">
                                    <span class="text-sm">Coming soon</span>
                                    <div class="w-10 h-6 bg-lamp-input rounded-full relative">
                                        <div class="w-4 h-4 bg-lamp-muted rounded-full absolute left-1 top-1"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="bg-lamp-card border border-lamp-border rounded-xl p-6">
                            <h3 class="font-medium mb-4">Chat Behavior</h3>
                            
                            <div class="flex items-center justify-between py-3">
                                <div>
                                    <p class="font-medium">Stream Responses</p>
                                    <p class="text-sm text-lamp-muted">Show responses as they're generated</p>
                                </div>
                                <div class="w-10 h-6 bg-amber-500 rounded-full relative cursor-pointer">
                                    <div class="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
                                </div>
                            </div>
                        </div>
                    </section>
                `;
                break;

            case 'api':
                html = `
                    <section class="mb-8">
                        <h2 class="text-xl font-semibold mb-6">API Keys</h2>
                        
                        <div class="bg-lamp-card border border-lamp-border rounded-xl p-6 mb-6">
                            <label class="block text-sm font-medium mb-2">OpenRouter API Key</label>
                            <div class="relative">
                                <input type="password" id="settingsApiKey" placeholder="sk-or-v1-..." 
                                    value="${settings?.apiKey || ''}"
                                    autocomplete="off"
                                    class="w-full px-4 py-2.5 pr-12 bg-lamp-input border border-lamp-border rounded-lg focus:outline-none focus:border-lamp-accent transition-colors font-mono text-sm">
                                <button type="button" id="toggleApiKeyBtn" class="absolute right-3 top-1/2 -translate-y-1/2 text-lamp-muted hover:text-lamp-text transition-colors">
                                    <svg id="eyeIcon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                    </svg>
                                </button>
                            </div>
                            <p class="text-xs text-lamp-muted mt-2">Get your API key from <a href="https://openrouter.ai/keys" target="_blank" class="text-lamp-accent underline hover:no-underline">openrouter.ai/keys</a></p>
                            
                            <button id="saveApiKeyBtn" class="mt-4 px-4 py-2 bg-lamp-accent text-white rounded-lg hover:bg-lamp-hover transition-colors">
                                Save API Key
                            </button>
                        </div>
                        
                        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <div class="flex items-start gap-3">
                                <svg class="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                </svg>
                                <div class="text-sm">
                                    <p class="font-medium text-amber-800">Your API key is stored locally</p>
                                    <p class="text-amber-700 mt-1">Your key is only stored in your browser's local storage and is never sent to any server except OpenRouter.</p>
                                </div>
                            </div>
                        </div>
                    </section>
                `;
                break;

            case 'models':
                const defaultModelOptions = MODELS.map(m =>
                    `<option value="${m.id}" ${m.id === settings?.selectedModel ? 'selected' : ''}>${m.name} (${m.provider})</option>`
                ).join('');

                const modelCheckboxes = MODELS.map(m => `
                    <label class="flex items-center gap-3 p-3 rounded-lg hover:bg-lamp-input cursor-pointer border border-transparent hover:border-lamp-border transition-colors">
                        <input type="checkbox" value="${m.id}" ${settings?.enabledModels?.includes(m.id) ? 'checked' : ''} 
                            class="model-checkbox w-4 h-4 rounded border-lamp-border text-lamp-accent focus:ring-lamp-accent">
                        <div class="flex-1">
                            <div class="text-sm font-medium">${m.name}</div>
                            <div class="text-xs text-lamp-muted">${m.provider}</div>
                        </div>
                        ${m.id === settings?.selectedModel ? '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Default</span>' : ''}
                    </label>
                `).join('');

                html = `
                    <section class="mb-8">
                        <h2 class="text-xl font-semibold mb-6">Models</h2>
                        
                        <div class="bg-lamp-card border border-lamp-border rounded-xl p-6 mb-6">
                            <label class="block text-sm font-medium mb-2">Default Model</label>
                            <select id="settingsDefaultModel" class="w-full px-4 py-2.5 bg-lamp-input border border-lamp-border rounded-lg focus:outline-none focus:border-lamp-accent transition-colors">
                                ${defaultModelOptions}
                            </select>
                            <p class="text-xs text-lamp-muted mt-2">This model will be selected by default for new chats</p>
                            
                            <button id="saveDefaultModelBtn" class="mt-4 px-4 py-2 bg-lamp-accent text-white rounded-lg hover:bg-lamp-hover transition-colors">
                                Save Default
                            </button>
                        </div>
                        
                        <div class="bg-lamp-card border border-lamp-border rounded-xl p-6">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="font-medium">Available Models</h3>
                                <span class="text-xs text-lamp-muted">${MODELS.length} models</span>
                            </div>
                            <div id="modelCheckboxes" class="space-y-1 max-h-96 overflow-y-auto">
                                ${modelCheckboxes}
                            </div>
                            <button id="saveModelsBtn" class="mt-4 px-4 py-2 bg-lamp-accent text-white rounded-lg hover:bg-lamp-hover transition-colors">
                                Save Model Selection
                            </button>
                        </div>
                    </section>
                `;
                break;

            case 'data':
                html = `
                    <section class="mb-8">
                        <h2 class="text-xl font-semibold mb-6">Data Management</h2>
                        
                        <div class="bg-lamp-card border border-lamp-border rounded-xl p-6 mb-6">
                            <h3 class="font-medium mb-2">Export Data</h3>
                            <p class="text-sm text-lamp-muted mb-4">Download all your chat history as a JSON file for backup or migration.</p>
                            <button id="exportDataBtn" class="px-4 py-2 bg-lamp-accent text-white rounded-lg hover:bg-lamp-hover transition-colors flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                </svg>
                                Export Chats
                            </button>
                        </div>
                        
                        <div class="bg-lamp-card border border-lamp-border rounded-xl p-6 mb-6">
                            <h3 class="font-medium mb-2">Import Data</h3>
                            <p class="text-sm text-lamp-muted mb-4">Import chat history from a previously exported JSON file.</p>
                            <button id="importDataBtn" class="px-4 py-2 border border-lamp-border rounded-lg hover:bg-lamp-input transition-colors flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                                </svg>
                                Import Chats
                            </button>
                            <input type="file" id="importFileInput" accept=".json" class="hidden">
                        </div>
                    </section>
                    
                    <!-- Danger Zone -->
                    <section>
                        <h2 class="text-xl font-semibold mb-4 text-red-600">Danger Zone</h2>
                        <div class="bg-lamp-card border border-red-200 rounded-xl p-6">
                            <p class="text-sm text-lamp-muted mb-4">Permanently delete all your chat history. This action cannot be undone.</p>
                            <button id="clearDataBtn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                                Delete All Chats
                            </button>
                        </div>
                    </section>
                `;
                break;
        }

        setHtml(this.elements.content, html);

        // Bind tab-specific buttons
        this._bindTabButtons(tab);
    }

    /**
     * Bind tab-specific button handlers
     * @private
     */
    _bindTabButtons(tab) {
        switch (tab) {
            case 'account':
                $('saveNameBtn')?.addEventListener('click', () => this._saveName());
                $('deleteAllBtn')?.addEventListener('click', () => this._clearData());
                break;
            case 'api':
                $('saveApiKeyBtn')?.addEventListener('click', () => this._saveApiKey());
                break;
            case 'models':
                $('saveDefaultModelBtn')?.addEventListener('click', () => this._saveDefaultModel());
                $('saveModelsBtn')?.addEventListener('click', () => this._saveEnabledModels());
                break;
            case 'data':
                $('exportDataBtn')?.addEventListener('click', () => this._exportData());
                $('importDataBtn')?.addEventListener('click', () => $('importFileInput')?.click());
                $('importFileInput')?.addEventListener('change', (e) => this._importData(e));
                $('clearDataBtn')?.addEventListener('click', () => this._clearData());
                break;
        }
    }

    /**
     * Toggle API key visibility
     * @private
     */
    _toggleApiKeyVisibility() {
        const input = $('settingsApiKey');
        const icon = $('eyeIcon');

        if (input && icon) {
            if (input.type === 'password') {
                input.type = 'text';
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>';
            } else {
                input.type = 'password';
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
            }
        }
    }

    /**
     * Save name
     * @private
     */
    async _saveName() {
        const name = $('settingsName')?.value || '';
        await stateManager.updateUser({ name });
        this._updateUserInfo();
        this._showToast('Name saved successfully!');
    }

    /**
     * Save API key
     * @private
     */
    async _saveApiKey() {
        const apiKey = $('settingsApiKey')?.value || '';
        await stateManager.updateSettings({ apiKey });
        this._showToast('API key saved successfully!');
    }

    /**
     * Save default model
     * @private
     */
    async _saveDefaultModel() {
        const selectedModel = $('settingsDefaultModel')?.value;
        await stateManager.updateSettings({ selectedModel });
        this._renderTabContent('models'); // Re-render to update badges
        this._showToast('Default model saved!');
    }

    /**
     * Save enabled models
     * @private
     */
    async _saveEnabledModels() {
        const checkboxes = document.querySelectorAll('.model-checkbox');
        const enabledModels = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        await stateManager.updateSettings({ enabledModels });
        this._showToast('Model selection saved!');
    }

    /**
     * Export data
     * @private
     */
    async _exportData() {
        const data = await stateManager.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lampchat-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this._showToast('Data exported successfully!');
    }

    /**
     * Import data
     * @private
     */
    async _importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate the import data schema
            if (!this._validateImportData(data)) {
                this._showToast('Failed to import: Invalid file format or missing required data');
                event.target.value = '';
                return;
            }

            // Confirm import with user
            const confirmed = await showConfirm(
                'This will merge imported chats with your existing data. Your current settings will be preserved unless overwritten by the import. Continue?',
                {
                    title: 'Import Data',
                    confirmText: 'Import',
                    cancelText: 'Cancel',
                    danger: false,
                }
            );

            if (!confirmed) {
                event.target.value = '';
                return;
            }

            // Perform the import
            const success = await stateManager.importData(data);

            if (success) {
                // Refresh UI elements
                this._updateUserInfo();
                this._updateChatCount();
                this._renderTabContent(this._activeTab);
                this._showToast('Data imported successfully!');
            } else {
                this._showToast('Failed to import data: An error occurred');
            }
        } catch (error) {
            console.error('Import error:', error);
            this._showToast('Failed to import data: Invalid JSON file');
        }

        event.target.value = '';
    }

    /**
     * Validate import data structure
     * @private
     * @param {Object} data - The parsed import data
     * @returns {boolean} - Whether the data is valid
     */
    _validateImportData(data) {
        // Must be an object
        if (!data || typeof data !== 'object') {
            return false;
        }

        // Must have at least one of the expected top-level keys
        const hasValidKeys = data.chats || data.user || data.settings;
        if (!hasValidKeys) {
            return false;
        }

        // If chats exist, validate structure
        if (data.chats) {
            if (typeof data.chats !== 'object') {
                return false;
            }
            // Validate each chat has required fields
            for (const chatId of Object.keys(data.chats)) {
                const chat = data.chats[chatId];
                if (!chat.id || !Array.isArray(chat.messages)) {
                    return false;
                }
            }
        }

        // If user exists, must be an object
        if (data.user && typeof data.user !== 'object') {
            return false;
        }

        // If settings exist, must be an object
        if (data.settings && typeof data.settings !== 'object') {
            return false;
        }

        return true;
    }

    /**
     * Clear all data
     * @private
     */
    async _clearData() {
        const confirmed = await showConfirm('Are you sure you want to delete all your data? This cannot be undone.', {
            title: 'Delete All Data',
            confirmText: 'Delete Everything',
            cancelText: 'Cancel',
            danger: true,
        });
        if (confirmed) {
            await stateManager.clearAllData();
            this._updateChatCount();
            this._showToast('All data deleted');
        }
    }

    /**
     * Show toast notification
     * @private
     */
    _showToast(message) {
        // Simple toast - could be enhanced later
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-lamp-accent text-white px-4 py-2 rounded-lg shadow-lg z-[60] animate-fade-in';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    /**
     * Cleanup
     */
    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
    }
}
