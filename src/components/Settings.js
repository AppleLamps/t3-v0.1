// Settings Modal Component
// ========================

import { stateManager } from '../services/state.js';
import { $, setHtml } from '../utils/dom.js';
import { MODELS } from '../config/models.js';

/**
 * Settings modal component
 */
export class Settings {
    constructor() {
        this.elements = {
            modal: null,
            closeBtn: null,
            tabs: null,
            content: null,
        };
        
        this._activeTab = 'account';
        this._unsubscribers = [];
    }
    
    /**
     * Initialize the settings modal
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
     * Render settings modal HTML
     * @private
     */
    _render() {
        return `
            <div id="settingsModal" class="hidden fixed inset-0 z-50">
                <div class="settings-backdrop absolute inset-0 bg-black/50"></div>
                <div class="absolute inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[80vh] bg-lamp-card rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                    <!-- Settings Header -->
                    <div class="flex items-center justify-between p-4 border-b border-lamp-border">
                        <h2 class="text-lg font-semibold">Settings</h2>
                        <button id="settingsCloseBtn" class="p-2 hover:bg-lamp-input rounded-lg transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Settings Tabs -->
                    <div class="flex border-b border-lamp-border" id="settingsTabs">
                        <button data-tab="account" class="settings-tab px-4 py-3 text-sm font-medium border-b-2 border-lamp-accent">Account</button>
                        <button data-tab="api" class="settings-tab px-4 py-3 text-sm font-medium border-b-2 border-transparent hover:border-lamp-muted transition-colors">API Keys</button>
                        <button data-tab="models" class="settings-tab px-4 py-3 text-sm font-medium border-b-2 border-transparent hover:border-lamp-muted transition-colors">Models</button>
                        <button data-tab="data" class="settings-tab px-4 py-3 text-sm font-medium border-b-2 border-transparent hover:border-lamp-muted transition-colors">Data</button>
                    </div>
                    
                    <!-- Settings Content -->
                    <div class="flex-1 overflow-y-auto p-6" id="settingsContent">
                        <!-- Content will be rendered based on active tab -->
                    </div>
                    
                    <!-- Settings Footer -->
                    <div class="p-4 border-t border-lamp-border flex justify-end gap-3">
                        <button id="settingsCancelBtn" class="px-4 py-2 border border-lamp-border rounded-lg hover:bg-lamp-input transition-colors">Cancel</button>
                        <button id="settingsSaveBtn" class="px-4 py-2 bg-lamp-accent text-white rounded-lg hover:bg-lamp-hover transition-colors">Save Changes</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Cache element references
     * @private
     */
    _cacheElements() {
        this.elements.modal = $('settingsModal');
        this.elements.closeBtn = $('settingsCloseBtn');
        this.elements.tabs = $('settingsTabs');
        this.elements.content = $('settingsContent');
        this.elements.cancelBtn = $('settingsCancelBtn');
        this.elements.saveBtn = $('settingsSaveBtn');
    }
    
    /**
     * Bind event handlers
     * @private
     */
    _bindEvents() {
        // Close button
        this.elements.closeBtn?.addEventListener('click', () => this.close());
        this.elements.cancelBtn?.addEventListener('click', () => this.close());
        
        // Backdrop click
        this.elements.modal?.querySelector('.settings-backdrop')?.addEventListener('click', () => this.close());
        
        // Tab switching
        this.elements.tabs?.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-tab]');
            if (tab) {
                this._switchTab(tab.dataset.tab);
            }
        });
        
        // Save button
        this.elements.saveBtn?.addEventListener('click', () => this._save());
        
        // API key visibility toggle (delegated)
        this.elements.content?.addEventListener('click', (e) => {
            if (e.target.closest('#toggleApiKeyBtn')) {
                this._toggleApiKeyVisibility();
            }
        });
    }
    
    /**
     * Open the settings modal
     */
    open() {
        this.elements.modal?.classList.remove('hidden');
        this._switchTab('account');
    }
    
    /**
     * Close the settings modal
     */
    close() {
        this.elements.modal?.classList.add('hidden');
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
                btn.classList.add('border-lamp-accent');
                btn.classList.remove('border-transparent');
            } else {
                btn.classList.remove('border-lamp-accent');
                btn.classList.add('border-transparent');
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
                    <div class="space-y-6">
                        <div>
                            <label class="block text-sm font-medium mb-2">Your Name</label>
                            <input type="text" id="settingsName" placeholder="Enter your name" 
                                value="${user?.name || ''}"
                                class="w-full px-4 py-2.5 bg-lamp-input border border-lamp-border rounded-lg focus:outline-none focus:border-lamp-accent transition-colors">
                            <p class="text-xs text-lamp-muted mt-1">This will be used to personalize your experience</p>
                        </div>
                    </div>
                `;
                break;
                
            case 'api':
                html = `
                    <div class="space-y-6">
                        <div>
                            <label class="block text-sm font-medium mb-2">OpenRouter API Key</label>
                            <div class="relative">
                                <input type="password" id="settingsApiKey" placeholder="sk-or-v1-..." 
                                    value="${settings?.apiKey || ''}"
                                    class="w-full px-4 py-2.5 pr-10 bg-lamp-input border border-lamp-border rounded-lg focus:outline-none focus:border-lamp-accent transition-colors font-mono text-sm">
                                <button type="button" id="toggleApiKeyBtn" class="absolute right-3 top-1/2 -translate-y-1/2 text-lamp-muted hover:text-lamp-text">
                                    <svg id="eyeIcon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                    </svg>
                                </button>
                            </div>
                            <p class="text-xs text-lamp-muted mt-1">Get your API key from <a href="https://openrouter.ai/keys" target="_blank" class="underline hover:text-lamp-text">openrouter.ai/keys</a></p>
                        </div>
                        <div class="p-4 bg-lamp-input rounded-lg border border-lamp-border">
                            <div class="flex items-start gap-3">
                                <svg class="w-5 h-5 text-amber-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <div class="text-sm">
                                    <p class="font-medium">Your API key is stored locally</p>
                                    <p class="text-lamp-muted mt-1">Your key is only stored in your browser's local storage and is never sent to any server except OpenRouter.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case 'models':
                const defaultModelOptions = MODELS.map(m => 
                    `<option value="${m.id}" ${m.id === settings?.selectedModel ? 'selected' : ''}>${m.name} (${m.provider})</option>`
                ).join('');
                
                const modelCheckboxes = MODELS.map(m => `
                    <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-lamp-input cursor-pointer">
                        <input type="checkbox" value="${m.id}" ${settings?.enabledModels?.includes(m.id) ? 'checked' : ''} 
                            class="model-checkbox w-4 h-4 rounded border-lamp-border text-lamp-accent focus:ring-lamp-accent">
                        <div>
                            <div class="text-sm font-medium">${m.name}</div>
                            <div class="text-xs text-lamp-muted">${m.provider}</div>
                        </div>
                    </label>
                `).join('');
                
                html = `
                    <div class="space-y-6">
                        <div>
                            <label class="block text-sm font-medium mb-2">Default Model</label>
                            <select id="settingsDefaultModel" class="w-full px-4 py-2.5 bg-lamp-input border border-lamp-border rounded-lg focus:outline-none focus:border-lamp-accent transition-colors">
                                ${defaultModelOptions}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-3">Available Models</label>
                            <div id="modelCheckboxes" class="space-y-2 max-h-64 overflow-y-auto">
                                ${modelCheckboxes}
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case 'data':
                html = `
                    <div class="space-y-6">
                        <div>
                            <h3 class="font-medium mb-2">Export Data</h3>
                            <p class="text-sm text-lamp-muted mb-3">Download all your chat history as a JSON file</p>
                            <button id="exportDataBtn" class="px-4 py-2 bg-lamp-accent text-white rounded-lg hover:bg-lamp-hover transition-colors">
                                Export Chats
                            </button>
                        </div>
                        <div class="pt-4 border-t border-lamp-border">
                            <h3 class="font-medium mb-2 text-red-600">Danger Zone</h3>
                            <p class="text-sm text-lamp-muted mb-3">Permanently delete all your chat history</p>
                            <button id="clearDataBtn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                                Delete All Chats
                            </button>
                        </div>
                    </div>
                `;
                break;
        }
        
        setHtml(this.elements.content, html);
        
        // Bind data tab buttons
        if (tab === 'data') {
            $('exportDataBtn')?.addEventListener('click', () => this._exportData());
            $('clearDataBtn')?.addEventListener('click', () => this._clearData());
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
     * Save settings
     * @private
     */
    async _save() {
        const tab = this._activeTab;
        
        switch (tab) {
            case 'account':
                const name = $('settingsName')?.value || '';
                await stateManager.updateUser({ name });
                break;
                
            case 'api':
                const apiKey = $('settingsApiKey')?.value || '';
                await stateManager.updateSettings({ apiKey });
                break;
                
            case 'models':
                const selectedModel = $('settingsDefaultModel')?.value;
                const checkboxes = document.querySelectorAll('.model-checkbox');
                const enabledModels = Array.from(checkboxes)
                    .filter(cb => cb.checked)
                    .map(cb => cb.value);
                
                await stateManager.updateSettings({ selectedModel, enabledModels });
                break;
        }
        
        this.close();
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
    }
    
    /**
     * Clear all data
     * @private
     */
    async _clearData() {
        if (confirm('Are you sure you want to delete all your chats? This cannot be undone.')) {
            await stateManager.clearAllData();
            this.close();
        }
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
    }
}

