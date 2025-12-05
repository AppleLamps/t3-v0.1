// Sidebar Component
// =================

import { stateManager } from '../services/state.js';
import { authService } from '../services/auth.js';
import { $, escapeHtml, setHtml } from '../utils/dom.js';
import { groupByDate, getDateGroup } from '../utils/date.js';
import { APP_NAME, DATE_GROUPS } from '../config/constants.js';
import { mixinComponentLifecycle } from './Component.js';

const THREAD_BUTTON_BASE = 'w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors';
const THREAD_BUTTON_ACTIVE = 'bg-lamp-card text-lamp-text';
const THREAD_BUTTON_INACTIVE = 'text-lamp-muted hover:text-lamp-text hover:bg-lamp-card/50';

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
            loadMoreBtn: null,
        };

        this._unsubscribers = [];
        this._searchDebounceTimer = null;
        this._searchResults = null; // Store search results separately
        this._isSearching = false;

        // Add lifecycle management for automatic cleanup
        mixinComponentLifecycle(this);
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
                
                <!-- Projects Section -->
                <div class="flex-shrink-0 px-2 py-2 border-b border-lamp-border">
                    <div class="flex items-center justify-between px-2 mb-2">
                        <span class="text-xs font-semibold text-lamp-muted uppercase tracking-wider">Projects</span>
                        <button id="newProjectBtn" class="p-1 hover:bg-lamp-input rounded-lg transition-colors text-lamp-muted hover:text-lamp-text" title="New Project">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                            </svg>
                        </button>
                    </div>
                    <div id="projectList" class="space-y-1 max-h-32 overflow-y-auto">
                        <!-- Projects will be rendered here -->
                    </div>
                </div>

                <!-- Thread List - Scrollable Middle Section -->
                <div id="threadList" class="flex-1 overflow-y-auto px-2 py-1 min-h-0">
                    <!-- Threads will be rendered here -->
                </div>
                
                <!-- Auth Button - Above User Profile -->
                <div class="flex-shrink-0 px-3 pt-2">
                    <button id="authBtn" class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium transition-colors ${isLoggedIn
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
        this.elements.projectList = $('projectList');
        this.elements.newProjectBtn = $('newProjectBtn');
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
     * Uses this.on() for automatic cleanup on destroy
     * @private
     */
    _bindEvents() {
        // New chat button
        if (this.elements.newChatBtn) {
            this.on(this.elements.newChatBtn, 'click', () => {
                this._onNewChat();
            });
        }

        // New project button
        if (this.elements.newProjectBtn) {
            this.on(this.elements.newProjectBtn, 'click', () => {
                this._onNewProject();
            });
        }

        // Search input with debounce
        if (this.elements.searchInput) {
            this.on(this.elements.searchInput, 'input', (e) => {
                this._handleDebouncedSearch(e.target.value);
                // Also call external handler if set
                if (this.onSearch) this.onSearch(e.target.value);
            });
        }

        // User profile button
        if (this.elements.userProfile) {
            this.on(this.elements.userProfile, 'click', () => {
                this._onSettingsClick();
            });
        }

        // Auth button
        if (this.elements.authBtn) {
            this.on(this.elements.authBtn, 'click', () => {
                this._onAuthClick();
            });
        }

        // Project list click delegation
        if (this.elements.projectList) {
            this.on(this.elements.projectList, 'click', (e) => {
                const projectBtn = e.target.closest('[data-project-id]');
                if (projectBtn) {
                    this._onSelectProject(projectBtn.dataset.projectId);
                }
            });
        }

        // Thread list click delegation
        if (this.elements.threadList) {
            this.on(this.elements.threadList, 'click', (e) => {
                const threadBtn = e.target.closest('[data-chat-id]');
                const deleteBtn = e.target.closest('[data-delete-id]');

                if (deleteBtn) {
                    e.stopPropagation();
                    this._onDeleteChat(deleteBtn.dataset.deleteId);
                } else if (threadBtn) {
                    this._onSelectChat(threadBtn.dataset.chatId);
                }
            });

            // Prefetch messages on hover to reduce perceived latency on click
            this.on(this.elements.threadList, 'pointerenter', (e) => {
                const threadBtn = e.target.closest('[data-chat-id]');
                if (!threadBtn) return;
                const chatId = threadBtn.dataset.chatId;
                if (!chatId || chatId.startsWith('temp_')) return;
                if (stateManager.isChatMessagesLoaded(chatId) || stateManager.isChatMessagesLoading(chatId)) return;
                // Fire-and-forget prefetch; loadMessages dedupes per chatId
                stateManager.loadMessages(chatId).catch(err => console.error('Prefetch on hover failed:', err));
            });
        }

        // Subscribe to auth changes
        this._unsubscribers.push(authService.subscribe(() => {
            this._updateAuthUI();
        }));
    }

    /**
     * Subscribe to state changes
     * @private
     */
    _subscribeToState() {
        this._unsubscribers.push(
            stateManager.subscribe('chatCreated', () => this.renderThreads()),
            stateManager.subscribe('chatUpdated', (state, chat) => this._handleChatUpdated(chat)),
            stateManager.subscribe('chatDeleted', () => this.renderThreads()),
            stateManager.subscribe('currentChatChanged', () => {
                if (!this._updateActiveChatHighlight()) {
                    this.renderThreads();
                }
            }),
            stateManager.subscribe('chatsLoaded', () => this.renderThreads()),
            stateManager.subscribe('chatsReloaded', () => {
                this._clearSearch();
                this.renderThreads();
            }),
            stateManager.subscribe('chatsLoading', (state, isLoading) => this._updateLoadingState(isLoading)),
            stateManager.subscribe('projectCreated', () => this.renderProjects()),
            stateManager.subscribe('projectUpdated', () => this.renderProjects()),
            stateManager.subscribe('projectDeleted', () => this.renderProjects()),
            stateManager.subscribe('projectSelected', () => {
                this.renderProjects();
                this.renderThreads();
            }),
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
            this.elements.authBtn.className = `w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium transition-colors ${isLoggedIn
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
        this.renderProjects();
        this.renderThreads();
        this._updateUserProfile();
    }

    /**
     * Render project list
     */
    renderProjects() {
        const projects = stateManager.allProjects;
        const currentProjectId = stateManager.state.currentProjectId;

        let html = '';

        // "All Chats" option when a project is selected
        if (currentProjectId) {
            html += `
                <button data-project-id="" class="w-full text-left px-3 py-2 rounded-lg text-sm text-lamp-muted hover:text-lamp-text hover:bg-lamp-card/50 transition-colors flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                    </svg>
                    All Chats
                </button>
            `;
        }

        if (projects.length === 0 && !currentProjectId) {
            html += '<div class="px-3 py-2 text-xs text-lamp-muted text-center">No projects yet</div>';
        } else {
            for (const project of projects) {
                const isActive = project.id === currentProjectId;
                html += `
                    <button data-project-id="${project.id}"
                        class="w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors flex items-center gap-2 ${isActive ? 'bg-amber-50 text-amber-700 font-medium' : 'text-lamp-muted hover:text-lamp-text hover:bg-lamp-card/50'}">
                        <svg class="w-4 h-4 flex-shrink-0 ${isActive ? 'text-amber-500' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                        </svg>
                        <span class="truncate">${escapeHtml(project.name)}</span>
                    </button>
                `;
            }
        }

        setHtml(this.elements.projectList, html);
    }

    /**
     * Render thread list
     */
    renderThreads() {
        const isSearching = this._searchResults !== null;
        // Use search results if we're in search mode, otherwise use cached chats
        const chats = isSearching ? this._searchResults : stateManager.allChats;
        const groups = groupByDate(chats);
        const currentChatId = stateManager.currentChat?.id;
        const hasMore = !isSearching && stateManager.hasMoreChats;
        const isLoading = !isSearching && stateManager.isLoadingChats;

        let html = '';

        const renderGroup = (title, chats) => {
            if (chats.length === 0) return '';
            let groupHtml = `
                <div class="thread-group mb-3" data-thread-group="${title}">
                    <div class="px-3 py-1.5 text-xs font-medium text-lamp-muted">${title}</div>
                    <div class="thread-group-items" data-thread-group-items="${title}">
            `;

            for (const chat of chats) {
                const isActive = chat.id === currentChatId;
                const buttonClass = this._composeThreadButtonClass(isActive);
                groupHtml += `
                    <div class="thread-item group relative" data-thread-id="${chat.id}" data-thread-group="${title}" data-updated-at="${chat.updatedAt}">
                        <button data-thread-button data-chat-id="${chat.id}"
                            class="${buttonClass}">
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

            groupHtml += `
                    </div>
                </div>
            `;
            return groupHtml;
        };

        html += renderGroup(DATE_GROUPS.TODAY, groups[DATE_GROUPS.TODAY]);
        html += renderGroup(DATE_GROUPS.YESTERDAY, groups[DATE_GROUPS.YESTERDAY]);
        html += renderGroup(DATE_GROUPS.LAST_WEEK, groups[DATE_GROUPS.LAST_WEEK]);
        html += renderGroup(DATE_GROUPS.OLDER, groups[DATE_GROUPS.OLDER]);

        // Add "Load More" button if there are more chats to load
        if (hasMore || isLoading) {
            html += `
                <div class="px-3 py-3">
                    <button id="loadMoreChatsBtn"
                        class="w-full py-2 px-4 text-sm text-lamp-muted hover:text-lamp-text hover:bg-lamp-card/50 rounded-lg transition-colors flex items-center justify-center gap-2 ${isLoading ? 'opacity-50 cursor-wait' : ''}"
                        ${isLoading ? 'disabled' : ''}>
                        ${isLoading ? `
                            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Loading...</span>
                        ` : `
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                            <span>Load More</span>
                        `}
                    </button>
                </div>
            `;
        }

        // Show search indicator if in search mode
        if (isSearching) {
            const searchCount = this._searchResults.length;
            html = `
                <div class="px-3 py-2 text-xs text-lamp-muted border-b border-lamp-border mb-2">
                    Found ${searchCount} chat${searchCount !== 1 ? 's' : ''}
                    <button id="clearSearchBtn" class="ml-2 text-lamp-accent hover:underline">Clear</button>
                </div>
            ` + html;
        }

        setHtml(this.elements.threadList, html || '<div class="px-3 py-8 text-center text-sm text-lamp-muted">No chats yet</div>');

        // Re-cache and bind load more button
        this._bindLoadMoreButton();
        this._bindClearSearchButton();
    }

    _composeThreadButtonClass(isActive) {
        return `${THREAD_BUTTON_BASE} ${isActive ? THREAD_BUTTON_ACTIVE : THREAD_BUTTON_INACTIVE}`;
    }

    _setThreadButtonState(button, isActive) {
        if (!button) return;
        button.className = this._composeThreadButtonClass(isActive);
    }

    _handleChatUpdated(chat) {
        if (!chat) return;

        if (this._searchResults !== null) {
            const index = this._searchResults.findIndex(c => c.id === chat.id);
            if (index !== -1) {
                this._searchResults[index] = { ...this._searchResults[index], ...chat };
                this.renderThreads();
                return;
            }
        }

        if (!this._updateThreadItem(chat)) {
            this.renderThreads();
        }
    }

    _updateThreadItem(chat) {
        if (!this.elements.threadList || this._searchResults !== null) {
            return false;
        }

        const threadNode = this.elements.threadList.querySelector(`[data-thread-id="${chat.id}"]`);
        if (!threadNode) {
            return false;
        }

        const targetGroup = getDateGroup(chat.updatedAt);
        if (threadNode.dataset.threadGroup !== targetGroup) {
            return false;
        }

        threadNode.dataset.updatedAt = String(chat.updatedAt);

        const button = threadNode.querySelector('[data-thread-button]');
        if (button) {
            button.textContent = chat.title || 'New Chat';
            button.dataset.chatId = chat.id;
            this._setThreadButtonState(button, chat.id === stateManager.currentChat?.id);
        }

        this._ensureThreadOrder(threadNode);
        return true;
    }

    _ensureThreadOrder(threadNode) {
        const container = threadNode.closest('[data-thread-group-items]');
        if (!container) return;

        const nodes = Array.from(container.querySelectorAll('.thread-item'));
        nodes
            .sort((a, b) => (Number(b.dataset.updatedAt) || 0) - (Number(a.dataset.updatedAt) || 0))
            .forEach(node => container.appendChild(node));
    }

    _updateActiveChatHighlight() {
        if (this._searchResults !== null) {
            this.renderThreads();
            return true;
        }

        if (!this.elements.threadList) {
            return false;
        }

        const currentChatId = stateManager.currentChat?.id || null;
        const buttons = this.elements.threadList.querySelectorAll('[data-thread-button]');
        let found = false;

        buttons.forEach(button => {
            const isActive = button.dataset.chatId === currentChatId;
            if (isActive) {
                found = true;
            }
            this._setThreadButtonState(button, isActive);
        });

        return found;
    }

    /**
     * Bind load more button click handler
     * @private
     */
    _bindLoadMoreButton() {
        const loadMoreBtn = document.getElementById('loadMoreChatsBtn');
        if (loadMoreBtn && !stateManager.isLoadingChats) {
            loadMoreBtn.addEventListener('click', () => this._onLoadMore());
        }
    }

    /**
     * Bind clear search button click handler
     * @private
     */
    _bindClearSearchButton() {
        const clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this._clearSearch());
        }
    }

    /**
     * Handle load more button click
     * @private
     */
    async _onLoadMore() {
        await stateManager.loadMoreChats();
    }

    /**
     * Update loading state in UI
     * @private
     * @param {boolean} isLoading
     */
    _updateLoadingState(isLoading) {
        const loadMoreBtn = document.getElementById('loadMoreChatsBtn');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = isLoading;
            loadMoreBtn.classList.toggle('opacity-50', isLoading);
            loadMoreBtn.classList.toggle('cursor-wait', isLoading);

            if (isLoading) {
                loadMoreBtn.innerHTML = `
                    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Loading...</span>
                `;
            } else {
                loadMoreBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                    <span>Load More</span>
                `;
            }
        }
    }

    /**
     * Clear search and return to normal view
     * @private
     */
    _clearSearch() {
        this._searchResults = null;
        this._isSearching = false;
        if (this.elements.searchInput) {
            this.elements.searchInput.value = '';
        }
        this.renderThreads();
    }

    /**
     * Handle search with debounce for server-side search
     * @private
     * @param {string} query
     */
    async _handleDebouncedSearch(query) {
        // Clear any existing debounce timer
        if (this._searchDebounceTimer) {
            clearTimeout(this._searchDebounceTimer);
        }

        // If query is empty, clear search
        if (!query.trim()) {
            this._clearSearch();
            return;
        }

        // Debounce search (300ms delay)
        this._searchDebounceTimer = setTimeout(async () => {
            this._isSearching = true;

            try {
                const result = await stateManager.searchChats(query);
                this._searchResults = result.chats;
                this.renderThreads();
            } catch (error) {
                console.error('Search failed:', error);
                this._searchResults = [];
                this.renderThreads();
            }

            this._isSearching = false;
        }, 300);
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

    _onNewProject() {
        if (this.onNewProject) this.onNewProject();
    }

    _onSelectProject(projectId) {
        if (this.onSelectProject) this.onSelectProject(projectId);
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
        this.onNewProject = handlers.onNewProject;
        this.onSelectProject = handlers.onSelectProject;
    }

    /**
     * Cleanup
     */
    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
    }
}
