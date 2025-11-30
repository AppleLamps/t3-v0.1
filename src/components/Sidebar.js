// Sidebar Component
// =================

import { stateManager } from '../services/state.js';
import { authService } from '../services/auth.js';
import { $, escapeHtml, setHtml } from '../utils/dom.js';
import { groupByDate } from '../utils/date.js';
import { APP_NAME, DATE_GROUPS } from '../config/constants.js';

/**
 * Sidebar component - handles chat list and navigation
 */
export class Sidebar {
    constructor() {
        this.elements = {
            sidebar: null,
            threadList: null,
            searchInput: null,
            newChatBtn: null,
            userProfile: null,
            authBtn: null,
            authBtnText: null,
            authBtnIcon: null,
            syncStatus: null,
        };
        
        this._unsubscribers = [];
    }
    
    /**
     * Initialize the sidebar
     * @param {string} containerId - Container element ID
     */
    init(containerId) {
        const container = $(containerId);
        if (!container) {
            console.error('Sidebar container not found');
            return;
        }
        
        container.innerHTML = this._render();
        this._cacheElements();
        this._bindEvents();
        this._subscribeToState();
        this.refresh();
    }
    
    /**
     * Render sidebar HTML
     * @private
     */
    _render() {
        const isLoggedIn = authService.isLoggedIn();
        const user = authService.currentUser;
        
        return `
            <aside id="sidebar" class="w-64 h-full bg-lamp-sidebar flex flex-col transition-all duration-300 ease-in-out overflow-hidden">
                <!-- Logo & New Chat - Fixed Top -->
                <div class="flex-shrink-0 p-3 pb-2">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="text-base font-semibold tracking-tight text-lamp-text">${APP_NAME}</span>
                        <!-- Sync Status Indicator -->
                        <div id="syncStatus" class="ml-auto flex items-center gap-1.5 text-xs ${isLoggedIn ? 'text-emerald-600' : 'text-lamp-muted'}">
                            ${isLoggedIn ? `
                                <div class="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                <span>Synced</span>
                            ` : `
                                <div class="w-2 h-2 bg-amber-400 rounded-full"></div>
                                <span>Local</span>
                            `}
                        </div>
                    </div>
                    <button id="newChatBtn" class="w-full bg-lamp-accent hover:bg-lamp-hover text-white py-2.5 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                        New Chat
                    </button>
                </div>
                
                <!-- Search - Fixed -->
                <div class="flex-shrink-0 px-3 pb-2">
                    <div class="relative">
                        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        <input type="text" id="sidebarSearch" placeholder="Search your threads..." 
                            autocomplete="off"
                            class="w-full bg-transparent py-2 pl-9 pr-3 text-sm placeholder:text-lamp-muted focus:outline-none transition-colors">
                    </div>
                </div>
                
                <!-- Thread List - Scrollable Middle Section -->
                <div id="threadList" class="flex-1 overflow-y-auto px-2 py-1 min-h-0">
                    <!-- Threads will be rendered here -->
                </div>
                
                <!-- Auth Button - Above User Profile -->
                <div class="flex-shrink-0 px-3 pt-2">
                    <button id="authBtn" class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium transition-colors ${
                        isLoggedIn 
                            ? 'bg-lamp-input hover:bg-red-50 text-lamp-muted hover:text-red-600 border border-lamp-border' 
                            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-orange-500/20'
                    }">
                        <svg id="authBtnIcon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${isLoggedIn ? `
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                            ` : `
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                            `}
                        </svg>
                        <span id="authBtnText">${isLoggedIn ? 'Sign Out' : 'Sign In'}</span>
                    </button>
                </div>
                
                <!-- User Profile / Settings - Fixed Bottom -->
                <div class="flex-shrink-0 p-3 border-t border-lamp-border bg-lamp-sidebar">
                    <button id="userProfileBtn" class="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-lamp-card transition-colors">
                        <div class="w-9 h-9 bg-gradient-to-br ${isLoggedIn ? 'from-emerald-400 to-teal-500' : 'from-teal-400 to-emerald-500'} rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            <span id="sidebarUserInitial">${this._getUserInitial()}</span>
                        </div>
                        <div class="flex-1 text-left min-w-0">
                            <div id="sidebarUserName" class="text-sm font-medium truncate">${this._getUserName()}</div>
                            <div id="sidebarUserStatus" class="text-xs text-lamp-muted">${isLoggedIn ? user?.email || 'Signed In' : 'Local Mode'}</div>
                        </div>
                        <svg class="w-5 h-5 text-lamp-muted flex-shrink-0 self-start mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                    </button>
                </div>
            </aside>
        `;
    }
    
    /**
     * Get user's display name
     * @private
     */
    _getUserName() {
        if (authService.isLoggedIn()) {
            return authService.currentUser?.name || authService.currentUser?.email?.split('@')[0] || 'User';
        }
        return stateManager.user?.name || 'User';
    }
    
    /**
     * Get user's initial
     * @private
     */
    _getUserInitial() {
        const name = this._getUserName();
        return name.charAt(0).toUpperCase();
    }
    
    /**
     * Cache element references
     * @private
     */
    _cacheElements() {
        this.elements.sidebar = $('sidebar');
        this.elements.threadList = $('threadList');
        this.elements.searchInput = $('sidebarSearch');
        this.elements.newChatBtn = $('newChatBtn');
        this.elements.userProfile = $('userProfileBtn');
        this.elements.userName = $('sidebarUserName');
        this.elements.userInitial = $('sidebarUserInitial');
        this.elements.userStatus = $('sidebarUserStatus');
        this.elements.authBtn = $('authBtn');
        this.elements.authBtnText = $('authBtnText');
        this.elements.authBtnIcon = $('authBtnIcon');
        this.elements.syncStatus = $('syncStatus');
    }
    
    /**
     * Bind event handlers
     * @private
     */
    _bindEvents() {
        // New chat button
        this.elements.newChatBtn?.addEventListener('click', () => {
            this._onNewChat();
        });
        
        // Search input
        this.elements.searchInput?.addEventListener('input', (e) => {
            this._onSearch(e.target.value);
        });
        
        // User profile button
        this.elements.userProfile?.addEventListener('click', () => {
            this._onSettingsClick();
        });
        
        // Auth button
        this.elements.authBtn?.addEventListener('click', () => {
            this._onAuthClick();
        });
        
        // Thread list click delegation
        this.elements.threadList?.addEventListener('click', (e) => {
            const threadBtn = e.target.closest('[data-chat-id]');
            const deleteBtn = e.target.closest('[data-delete-id]');
            
            if (deleteBtn) {
                e.stopPropagation();
                this._onDeleteChat(deleteBtn.dataset.deleteId);
            } else if (threadBtn) {
                this._onSelectChat(threadBtn.dataset.chatId);
            }
        });
        
        // Subscribe to auth changes
        authService.subscribe(() => {
            this._updateAuthUI();
        });
    }
    
    /**
     * Subscribe to state changes
     * @private
     */
    _subscribeToState() {
        this._unsubscribers.push(
            stateManager.subscribe('chatCreated', () => this.renderThreads()),
            stateManager.subscribe('chatUpdated', () => this.renderThreads()),
            stateManager.subscribe('chatDeleted', () => this.renderThreads()),
            stateManager.subscribe('currentChatChanged', () => this.renderThreads()),
            stateManager.subscribe('userUpdated', () => this._updateUserProfile()),
            stateManager.subscribe('sidebarToggled', (state, open) => this._toggleVisibility(open)),
        );
    }
    
    /**
     * Update auth-related UI elements
     * @private
     */
    _updateAuthUI() {
        const isLoggedIn = authService.isLoggedIn();
        const user = authService.currentUser;
        
        // Update auth button
        if (this.elements.authBtn) {
            this.elements.authBtn.className = `w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium transition-colors ${
                isLoggedIn 
                    ? 'bg-lamp-input hover:bg-red-50 text-lamp-muted hover:text-red-600 border border-lamp-border' 
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-orange-500/20'
            }`;
        }
        
        if (this.elements.authBtnText) {
            this.elements.authBtnText.textContent = isLoggedIn ? 'Sign Out' : 'Sign In';
        }
        
        if (this.elements.authBtnIcon) {
            this.elements.authBtnIcon.innerHTML = isLoggedIn 
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>';
        }
        
        // Update sync status
        if (this.elements.syncStatus) {
            this.elements.syncStatus.className = `ml-auto flex items-center gap-1.5 text-xs ${isLoggedIn ? 'text-emerald-600' : 'text-lamp-muted'}`;
            this.elements.syncStatus.innerHTML = isLoggedIn 
                ? '<div class="w-2 h-2 bg-emerald-500 rounded-full"></div><span>Synced</span>'
                : '<div class="w-2 h-2 bg-amber-400 rounded-full"></div><span>Local</span>';
        }
        
        // Update user profile
        if (this.elements.userStatus) {
            this.elements.userStatus.textContent = isLoggedIn ? (user?.email || 'Signed In') : 'Local Mode';
        }
        
        this._updateUserProfile();
    }
    
    /**
     * Refresh sidebar content
     */
    refresh() {
        this.renderThreads();
        this._updateUserProfile();
    }
    
    /**
     * Render thread list
     */
    renderThreads() {
        const chats = stateManager.allChats;
        const groups = groupByDate(chats);
        const currentChatId = stateManager.currentChat?.id;
        
        let html = '';
        
        const renderGroup = (title, chats) => {
            if (chats.length === 0) return '';
            let groupHtml = `<div class="mb-3"><div class="px-3 py-1.5 text-xs font-medium text-lamp-muted">${title}</div>`;
            
            for (const chat of chats) {
                const isActive = chat.id === currentChatId;
                groupHtml += `
                    <div class="thread-item group relative">
                        <button data-chat-id="${chat.id}" 
                            class="w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${isActive ? 'bg-lamp-card text-lamp-text' : 'text-lamp-muted hover:text-lamp-text hover:bg-lamp-card/50'}">
                            ${escapeHtml(chat.title)}
                        </button>
                        <div class="thread-actions absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                            <button data-delete-id="${chat.id}" class="p-1.5 hover:bg-lamp-input rounded-lg transition-colors" title="Delete">
                                <svg class="w-3.5 h-3.5 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            }
            
            groupHtml += '</div>';
            return groupHtml;
        };
        
        html += renderGroup(DATE_GROUPS.TODAY, groups[DATE_GROUPS.TODAY]);
        html += renderGroup(DATE_GROUPS.YESTERDAY, groups[DATE_GROUPS.YESTERDAY]);
        html += renderGroup(DATE_GROUPS.LAST_WEEK, groups[DATE_GROUPS.LAST_WEEK]);
        html += renderGroup(DATE_GROUPS.OLDER, groups[DATE_GROUPS.OLDER]);
        
        setHtml(this.elements.threadList, html || '<div class="px-3 py-8 text-center text-sm text-lamp-muted">No chats yet</div>');
    }
    
    /**
     * Update user profile display
     * @private
     */
    _updateUserProfile() {
        const name = this._getUserName();
        
        if (this.elements.userName) {
            this.elements.userName.textContent = name;
        }
        if (this.elements.userInitial) {
            this.elements.userInitial.textContent = name.charAt(0).toUpperCase();
        }
    }
    
    /**
     * Toggle sidebar visibility
     * @private
     */
    _toggleVisibility(open) {
        if (this.elements.sidebar) {
            if (open) {
                this.elements.sidebar.classList.remove('w-0');
                this.elements.sidebar.classList.add('w-64');
            } else {
                this.elements.sidebar.classList.remove('w-64');
                this.elements.sidebar.classList.add('w-0');
            }
        }
    }
    
    // Event handlers - these will be connected to external handlers
    _onNewChat() {
        if (this.onNewChat) this.onNewChat();
    }
    
    _onSelectChat(chatId) {
        if (this.onSelectChat) this.onSelectChat(chatId);
    }
    
    _onDeleteChat(chatId) {
        if (this.onDeleteChat) this.onDeleteChat(chatId);
    }
    
    _onSearch(query) {
        if (this.onSearch) this.onSearch(query);
    }
    
    _onSettingsClick() {
        if (this.onSettingsClick) this.onSettingsClick();
    }
    
    _onAuthClick() {
        if (this.onAuthClick) this.onAuthClick();
    }
    
    /**
     * Set external event handlers
     * @param {Object} handlers 
     */
    setHandlers(handlers) {
        this.onNewChat = handlers.onNewChat;
        this.onSelectChat = handlers.onSelectChat;
        this.onDeleteChat = handlers.onDeleteChat;
        this.onSearch = handlers.onSearch;
        this.onSettingsClick = handlers.onSettingsClick;
        this.onAuthClick = handlers.onAuthClick;
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
    }
}
