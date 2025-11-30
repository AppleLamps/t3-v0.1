// Project Modal Component
// =======================
// Modal for creating and editing projects

import { $, setHtml } from '../utils/dom.js';
import { stateManager } from '../services/state.js';

/**
 * Project modal component - handles project creation and editing
 */
export class ProjectModal {
    constructor() {
        this.elements = {
            modal: null,
            form: null,
            title: null,
            subtitle: null,
            nameInput: null,
            descriptionInput: null,
            visibilityPrivate: null,
            visibilityShared: null,
            submitBtn: null,
            errorMessage: null,
        };

        this._mode = 'create'; // 'create' | 'edit'
        this._editingProjectId = null;
        this._isLoading = false;
        this._onSuccess = null;
    }

    /**
     * Initialize the project modal
     * @param {string} containerId - Container element ID
     */
    init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Project modal container not found:', containerId);
            return;
        }

        container.innerHTML = this._render();
        this._cacheElements();
        this._bindEvents();
    }

    /**
     * Render modal HTML
     * @private
     */
    _render() {
        return `
            <div id="projectModal" class="fixed inset-0 z-[100] items-center justify-center" style="display: none;">
                <!-- Backdrop -->
                <div id="projectBackdrop" class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
                
                <!-- Modal Content -->
                <div class="relative bg-lamp-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-scale-in">
                    <!-- Header -->
                    <div class="relative px-8 pt-8 pb-6 text-center border-b border-lamp-border bg-gradient-to-b from-lamp-sidebar to-lamp-card">
                        <button id="projectCloseBtn" class="absolute top-4 right-4 p-2 text-lamp-muted hover:text-lamp-text rounded-lg hover:bg-lamp-input transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                        
                        <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                            </svg>
                        </div>
                        
                        <h2 id="projectTitle" class="text-2xl font-bold text-lamp-text">New Project</h2>
                        <p id="projectSubtitle" class="text-sm text-lamp-muted mt-1">Create a workspace for related chats</p>
                    </div>
                    
                    <!-- Form -->
                    <form id="projectForm" class="p-8 space-y-5">
                        <!-- Error Message -->
                        <div id="projectError" class="hidden p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                            Error message here
                        </div>
                        
                        <!-- Name Input -->
                        <div>
                            <label for="projectName" class="block text-sm font-medium text-lamp-text mb-2">Project Name</label>
                            <input 
                                type="text" 
                                id="projectName" 
                                name="name"
                                class="w-full px-4 py-3 bg-lamp-input border border-lamp-border rounded-xl text-lamp-text placeholder-lamp-muted focus:outline-none focus:border-lamp-accent focus:ring-2 focus:ring-lamp-accent/20 transition-all"
                                placeholder="My Awesome Project"
                                required
                            >
                        </div>
                        
                        <!-- Description Input -->
                        <div>
                            <label for="projectDescription" class="block text-sm font-medium text-lamp-text mb-2">Description <span class="text-lamp-muted">(optional)</span></label>
                            <textarea 
                                id="projectDescription" 
                                name="description"
                                rows="3"
                                class="w-full px-4 py-3 bg-lamp-input border border-lamp-border rounded-xl text-lamp-text placeholder-lamp-muted focus:outline-none focus:border-lamp-accent focus:ring-2 focus:ring-lamp-accent/20 transition-all resize-none"
                                placeholder="What is this project about?"
                            ></textarea>
                        </div>
                        
                        <!-- Visibility Radio -->
                        <div>
                            <label class="block text-sm font-medium text-lamp-text mb-3">Visibility</label>
                            <div class="flex gap-4">
                                <label class="flex items-center gap-3 px-4 py-3 bg-lamp-input border border-lamp-border rounded-xl cursor-pointer hover:border-amber-400 transition-colors flex-1">
                                    <input type="radio" id="visibilityPrivate" name="visibility" value="private" checked class="w-4 h-4 text-amber-500 focus:ring-amber-500">
                                    <div>
                                        <span class="text-sm font-medium text-lamp-text">Private</span>
                                        <p class="text-xs text-lamp-muted">Only you can see this</p>
                                    </div>
                                </label>
                                <label class="flex items-center gap-3 px-4 py-3 bg-lamp-input border border-lamp-border rounded-xl cursor-pointer hover:border-amber-400 transition-colors flex-1">
                                    <input type="radio" id="visibilityShared" name="visibility" value="shared" class="w-4 h-4 text-amber-500 focus:ring-amber-500">
                                    <div>
                                        <span class="text-sm font-medium text-lamp-text">Shared</span>
                                        <p class="text-xs text-lamp-muted">Share with a link</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <!-- Submit Button -->
                        <button 
                            type="submit" 
                            id="projectSubmitBtn"
                            class="w-full py-3.5 bg-lamp-accent text-white font-semibold rounded-xl hover:bg-lamp-hover transition-all shadow-lg shadow-lamp-accent/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create Project
                        </button>
                    </form>
                </div>
            </div>
        `;
    }

    /**
     * Cache DOM elements
     * @private
     */
    _cacheElements() {
        this.elements.modal = document.getElementById('projectModal');
        this.elements.form = document.getElementById('projectForm');
        this.elements.title = document.getElementById('projectTitle');
        this.elements.subtitle = document.getElementById('projectSubtitle');
        this.elements.nameInput = document.getElementById('projectName');
        this.elements.descriptionInput = document.getElementById('projectDescription');
        this.elements.visibilityPrivate = document.getElementById('visibilityPrivate');
        this.elements.visibilityShared = document.getElementById('visibilityShared');
        this.elements.submitBtn = document.getElementById('projectSubmitBtn');
        this.elements.errorMessage = document.getElementById('projectError');
    }

    /**
     * Bind event listeners
     * @private
     */
    _bindEvents() {
        // Close modal
        document.getElementById('projectCloseBtn')?.addEventListener('click', () => this.hide());
        document.getElementById('projectBackdrop')?.addEventListener('click', () => this.hide());

        // Form submission
        this.elements.form?.addEventListener('submit', (e) => this._handleSubmit(e));

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.modal?.style.display !== 'none') {
                this.hide();
            }
        });
    }

    /**
     * Handle form submission
     * @private
     */
    async _handleSubmit(e) {
        e.preventDefault();

        if (this._isLoading) return;

        const name = this.elements.nameInput?.value?.trim();
        const description = this.elements.descriptionInput?.value?.trim() || '';
        const visibility = this.elements.visibilityShared?.checked ? 'shared' : 'private';

        if (!name) {
            this._showError('Project name is required');
            return;
        }

        this._setLoading(true);
        this._hideError();

        try {
            let project;
            if (this._mode === 'edit' && this._editingProjectId) {
                project = await stateManager.updateProject(this._editingProjectId, {
                    name,
                    description,
                    visibility,
                });
            } else {
                project = await stateManager.createProject({
                    name,
                    description,
                    visibility,
                });
            }

            this.hide();

            if (this._onSuccess) {
                this._onSuccess(project);
            }
        } catch (error) {
            console.error('Project operation failed:', error);
            this._showError(error.message || 'Operation failed. Please try again.');
        } finally {
            this._setLoading(false);
        }
    }

    /**
     * Show the modal for creating a new project
     * @param {Function} [onSuccess] - Callback on successful creation
     */
    show(onSuccess = null) {
        this._mode = 'create';
        this._editingProjectId = null;
        this._onSuccess = onSuccess;
        this._resetForm();

        if (this.elements.title) this.elements.title.textContent = 'New Project';
        if (this.elements.subtitle) this.elements.subtitle.textContent = 'Create a workspace for related chats';
        if (this.elements.submitBtn) this.elements.submitBtn.textContent = 'Create Project';

        if (this.elements.modal) {
            this.elements.modal.style.display = 'flex';
        }
        this.elements.nameInput?.focus();
    }

    /**
     * Show the modal for editing an existing project
     * @param {Object} project - Project to edit
     * @param {Function} [onSuccess] - Callback on successful update
     */
    showEdit(project, onSuccess = null) {
        this._mode = 'edit';
        this._editingProjectId = project.id;
        this._onSuccess = onSuccess;

        if (this.elements.title) this.elements.title.textContent = 'Edit Project';
        if (this.elements.subtitle) this.elements.subtitle.textContent = 'Update project details';
        if (this.elements.submitBtn) this.elements.submitBtn.textContent = 'Save Changes';

        // Populate form
        if (this.elements.nameInput) this.elements.nameInput.value = project.name || '';
        if (this.elements.descriptionInput) this.elements.descriptionInput.value = project.description || '';
        if (project.visibility === 'shared') {
            if (this.elements.visibilityShared) this.elements.visibilityShared.checked = true;
        } else {
            if (this.elements.visibilityPrivate) this.elements.visibilityPrivate.checked = true;
        }

        this._hideError();
        if (this.elements.modal) {
            this.elements.modal.style.display = 'flex';
        }
        this.elements.nameInput?.focus();
    }

    /**
     * Hide the modal
     */
    hide() {
        if (this.elements.modal) {
            this.elements.modal.style.display = 'none';
        }
        this._resetForm();
    }

    /**
     * Reset form fields
     * @private
     */
    _resetForm() {
        this.elements.form?.reset();
        this._hideError();
    }

    /**
     * Show error message
     * @private
     */
    _showError(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorMessage.classList.remove('hidden');
        }
    }

    /**
     * Hide error message
     * @private
     */
    _hideError() {
        this.elements.errorMessage?.classList.add('hidden');
    }

    /**
     * Set loading state
     * @private
     */
    _setLoading(loading) {
        this._isLoading = loading;
        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = loading;
            this.elements.submitBtn.textContent = loading
                ? 'Please wait...'
                : (this._mode === 'edit' ? 'Save Changes' : 'Create Project');
        }
    }
}
