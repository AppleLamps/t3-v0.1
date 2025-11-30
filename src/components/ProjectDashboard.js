// Project Dashboard Component
// ============================
// Dashboard view for managing a project's settings, files, and chats

import { $, setHtml, showConfirm } from '../utils/dom.js';
import { stateManager } from '../services/state.js';
import { formatRelativeTime } from '../utils/date.js';
import { fileToBase64 } from '../utils/files.js';

/**
 * Project Dashboard component - displays project overview and settings
 */
export class ProjectDashboard {
    constructor() {
        this.elements = {
            container: null,
            instructionsTextarea: null,
            fileList: null,
            chatList: null,
        };

        this._handlers = {};
        this._unsubscribers = [];
        this._saveTimeout = null;
    }

    /**
     * Initialize the dashboard
     * @param {string} containerId - Container element ID
     */
    init(containerId) {
        this.elements.container = $(containerId);
        if (!this.elements.container) {
            console.error('ProjectDashboard container not found');
            return;
        }

        // Subscribe to state changes
        this._unsubscribers.push(
            stateManager.subscribe('projectSelected', () => this.refresh()),
            stateManager.subscribe('projectUpdated', () => this.refresh())
        );
    }

    /**
     * Set event handlers
     * @param {Object} handlers
     */
    setHandlers(handlers) {
        this._handlers = handlers;
    }

    /**
     * Render the dashboard for the current project
     */
    refresh() {
        const project = stateManager.currentProject;

        if (!project) {
            if (this.elements.container) {
                this.elements.container.innerHTML = '';
                this.elements.container.style.display = 'none';
            }
            return;
        }

        if (this.elements.container) {
            this.elements.container.style.display = '';
        }
        this.elements.container.innerHTML = this._render(project);
        this._cacheElements();
        this._bindEvents(project);
    }

    /**
     * Render dashboard HTML
     * @private
     */
    _render(project) {
        const files = project.files || [];
        const chats = stateManager.allChats; // Already filtered by currentProjectId

        return `
            <div class="flex-1 overflow-y-auto p-6 md:p-10">
                <!-- Header -->
                <div class="flex items-center justify-between mb-8">
                    <div class="flex items-center gap-4">
                        <button id="dashboardBackBtn" class="p-2 rounded-lg hover:bg-lamp-input transition-colors text-lamp-muted hover:text-lamp-text">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                            </svg>
                        </button>
                        <div>
                            <h1 class="text-2xl font-bold text-lamp-text">${this._escapeHtml(project.name)}</h1>
                            <p class="text-sm text-lamp-muted">${project.description || 'No description'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="dashboardEditBtn" class="px-4 py-2 text-sm font-medium text-lamp-text bg-lamp-input hover:bg-lamp-border rounded-lg transition-colors">
                            Edit Project
                        </button>
                        <button id="dashboardDeleteBtn" class="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            Delete
                        </button>
                    </div>
                </div>

                <!-- Grid Layout -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Custom Instructions Card -->
                    <div class="bg-lamp-card rounded-2xl border border-lamp-border p-6 shadow-sm">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                                </svg>
                            </div>
                            <div>
                                <h2 class="font-semibold text-lamp-text">Custom Instructions</h2>
                                <p class="text-xs text-lamp-muted">System prompt for all chats in this project</p>
                            </div>
                        </div>
                        <textarea 
                            id="projectInstructions"
                            class="w-full h-40 px-4 py-3 bg-lamp-input border border-lamp-border rounded-xl text-lamp-text placeholder-lamp-muted focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                            placeholder="Enter custom instructions for the AI... (e.g., 'You are a helpful coding assistant specializing in React.')"
                        >${this._escapeHtml(project.instructions || '')}</textarea>
                        <p id="instructionsSaveStatus" class="text-xs text-lamp-muted mt-2">Changes save automatically</p>
                    </div>

                    <!-- Project Files Card -->
                    <div class="bg-lamp-card rounded-2xl border border-lamp-border p-6 shadow-sm">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h2 class="font-semibold text-lamp-text">Project Files</h2>
                                    <p class="text-xs text-lamp-muted">Knowledge base for context</p>
                                </div>
                            </div>
                            <label class="px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg cursor-pointer transition-colors">
                                <input type="file" id="projectFileInput" class="hidden" multiple accept=".txt,.md,.json,.csv,.pdf">
                                Add File
                            </label>
                        </div>
                        ${this._renderFileList(files)}
                    </div>
                </div>

                <!-- Project Chats Section -->
                <div class="mt-6 bg-lamp-card rounded-2xl border border-lamp-border p-6 shadow-sm">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                </svg>
                            </div>
                            <div>
                                <h2 class="font-semibold text-lamp-text">Project Chats</h2>
                                <p class="text-xs text-lamp-muted">${chats.length} chat${chats.length !== 1 ? 's' : ''} in this project</p>
                            </div>
                        </div>
                        <button id="newProjectChatBtn" class="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-lg transition-colors">
                            New Chat
                        </button>
                    </div>
                    ${this._renderChatList(chats)}
                </div>
            </div>
        `;
    }

    /**
     * Render file list
     * @private
     */
    _renderFileList(files) {
        if (files.length === 0) {
            return `
                <div class="text-center py-8 text-lamp-muted">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                    </svg>
                    <p class="text-sm">No files yet</p>
                    <p class="text-xs mt-1">Upload files to provide context for your chats</p>
                </div>
            `;
        }

        return `
            <div id="projectFileList" class="space-y-2 max-h-48 overflow-y-auto">
                ${files.map(file => `
                    <div class="flex items-center justify-between px-3 py-2 bg-lamp-input rounded-lg group">
                        <div class="flex items-center gap-3 overflow-hidden">
                            <svg class="w-4 h-4 text-lamp-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            <span class="text-sm text-lamp-text truncate">${this._escapeHtml(file.name)}</span>
                            <span class="text-xs text-lamp-muted">${this._formatFileSize(file.size)}</span>
                        </div>
                        <button class="project-file-remove opacity-0 group-hover:opacity-100 p-1 text-lamp-muted hover:text-red-500 transition-all" data-file-id="${file.id}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render chat list
     * @private
     */
    _renderChatList(chats) {
        if (chats.length === 0) {
            return `
                <div class="text-center py-8 text-lamp-muted">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                    <p class="text-sm">No chats yet</p>
                    <p class="text-xs mt-1">Start a new chat to begin</p>
                </div>
            `;
        }

        return `
            <div id="projectChatList" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                ${chats.slice(0, 9).map(chat => `
                    <button class="project-chat-item text-left px-4 py-3 bg-lamp-input hover:bg-lamp-border rounded-xl transition-colors" data-chat-id="${chat.id}">
                        <p class="font-medium text-lamp-text truncate">${this._escapeHtml(chat.title)}</p>
                        <p class="text-xs text-lamp-muted mt-1">${formatRelativeTime(chat.updatedAt)}</p>
                    </button>
                `).join('')}
                ${chats.length > 9 ? `
                    <div class="flex items-center justify-center px-4 py-3 bg-lamp-input rounded-xl text-lamp-muted text-sm">
                        +${chats.length - 9} more
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Cache DOM elements
     * @private
     */
    _cacheElements() {
        this.elements.instructionsTextarea = $('#projectInstructions');
        this.elements.fileList = $('#projectFileList');
        this.elements.chatList = $('#projectChatList');
    }

    /**
     * Bind events
     * @private
     */
    _bindEvents(project) {
        // Back button
        $('#dashboardBackBtn')?.addEventListener('click', () => {
            stateManager.selectProject(null);
        });

        // Edit button
        $('#dashboardEditBtn')?.addEventListener('click', () => {
            this._handlers.onEditProject?.(project);
        });

        // Delete button
        $('#dashboardDeleteBtn')?.addEventListener('click', async () => {
            const confirmed = await showConfirm(
                `Are you sure you want to delete "${project.name}"? This will not delete the chats, but they will be unlinked from this project.`,
                {
                    title: 'Delete Project',
                    confirmText: 'Delete',
                    cancelText: 'Cancel',
                    danger: true,
                }
            );
            if (confirmed) {
                await stateManager.deleteProject(project.id);
            }
        });

        // Instructions auto-save
        this.elements.instructionsTextarea?.addEventListener('input', () => {
            this._debouncedSaveInstructions(project.id);
        });

        // File upload
        $('#projectFileInput')?.addEventListener('change', async (e) => {
            await this._handleFileUpload(project.id, e.target.files);
            e.target.value = ''; // Reset input
        });

        // File remove buttons
        document.querySelectorAll('.project-file-remove').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const fileId = btn.dataset.fileId;
                await stateManager.removeProjectFile(project.id, fileId);
            });
        });

        // Chat items
        document.querySelectorAll('.project-chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                this._handlers.onSelectChat?.(chatId);
            });
        });

        // New chat button
        $('#newProjectChatBtn')?.addEventListener('click', () => {
            this._handlers.onNewChat?.();
        });
    }

    /**
     * Debounced save for instructions
     * @private
     */
    _debouncedSaveInstructions(projectId) {
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }

        const statusEl = $('#instructionsSaveStatus');
        if (statusEl) statusEl.textContent = 'Saving...';

        this._saveTimeout = setTimeout(async () => {
            const instructions = this.elements.instructionsTextarea?.value || '';
            await stateManager.updateProject(projectId, { instructions });
            if (statusEl) statusEl.textContent = 'Saved';
        }, 1000);
    }

    /**
     * Handle file upload
     * @private
     */
    async _handleFileUpload(projectId, files) {
        for (const file of files) {
            try {
                const base64 = await fileToBase64(file);
                await stateManager.addProjectFile(projectId, {
                    name: file.name,
                    type: file.type || 'text/plain',
                    data: base64,
                    size: file.size,
                });
            } catch (error) {
                console.error('Failed to upload file:', error);
            }
        }
    }

    /**
     * Format file size
     * @private
     */
    _formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Escape HTML
     * @private
     */
    _escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Show the dashboard
     */
    show() {
        if (this.elements.container) {
            this.elements.container.style.display = '';
        }
        this.refresh();
    }

    /**
     * Hide the dashboard
     */
    hide() {
        if (this.elements.container) {
            this.elements.container.style.display = 'none';
        }
    }

    /**
     * Cleanup subscriptions
     */
    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
        this._unsubscribers = [];
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }
    }
}

