// Model Selector Component
// ========================
// Handles model dropdown, search, and selection

import { $, setHtml } from '../../utils/dom.js';
import { stateManager } from '../../services/state.js';
import { MODELS, getModelById } from '../../config/models.js';

/**
 * Model selector class - handles model selection UI
 */
export class ModelSelector {
    /**
     * @param {HTMLElement} modelButton - Button to toggle dropdown
     * @param {HTMLElement} modelDropdown - Dropdown container
     * @param {HTMLElement} modelList - List container for models
     * @param {HTMLElement} modelSearch - Search input
     * @param {HTMLElement} selectedModelName - Element to display selected model name
     */
    constructor(modelButton, modelDropdown, modelList, modelSearch, selectedModelName) {
        this.modelButton = modelButton;
        this.modelDropdown = modelDropdown;
        this.modelList = modelList;
        this.modelSearch = modelSearch;
        this.selectedModelName = selectedModelName;
    }

    /**
     * Initialize the model selector
     */
    init() {
        this._bindEvents();
        this.refresh();
    }

    /**
     * Bind event handlers
     * @private
     */
    _bindEvents() {
        // Model dropdown toggle
        this.modelButton?.addEventListener('click', () => {
            this._toggleDropdown();
        });

        // Model search
        this.modelSearch?.addEventListener('input', (e) => {
            this._filterModels(e.target.value);
        });

        // Model selection (delegated)
        this.modelList?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-model-id]');
            if (btn) {
                this._selectModel(btn.dataset.modelId);
            }
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!this.modelDropdown?.contains(e.target) &&
                !this.modelButton?.contains(e.target)) {
                this.modelDropdown?.classList.add('hidden');
            }
        });
    }

    /**
     * Refresh the model selector
     */
    refresh() {
        this._updateSelectedModel();
        this._renderModelList();
    }

    /**
     * Toggle model dropdown
     * @private
     */
    _toggleDropdown() {
        this.modelDropdown?.classList.toggle('hidden');
        if (!this.modelDropdown?.classList.contains('hidden')) {
            this.modelSearch?.focus();
        }
    }

    /**
     * Render model list
     * @private
     */
    _renderModelList() {
        const settings = stateManager.settings;
        // Default to all models enabled if enabledModels is undefined, null, empty, or contains no valid IDs
        const enabledModelIds = settings?.enabledModels;
        const validModelIds = MODELS.map(m => m.id);
        const hasValidEnabled = enabledModelIds && enabledModelIds.length > 0 && 
            enabledModelIds.some(id => validModelIds.includes(id));
        const enabledModels = hasValidEnabled 
            ? MODELS.filter(m => enabledModelIds.includes(m.id))
            : MODELS; // Show all models by default
        const selectedModel = settings?.selectedModel;

        let html = '';
        for (const model of enabledModels) {
            const isSelected = model.id === selectedModel;
            const hasImageCap = model.capabilities?.includes('image');
            const hasVisionCap = model.capabilities?.includes('vision');
            
            html += `
                <button type="button" data-model-id="${model.id}" 
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-lamp-input transition-colors ${isSelected ? 'bg-lamp-input' : ''}">
                    <div class="flex-1">
                        <div class="text-sm font-medium flex items-center gap-2">
                            ${model.name}
                            ${hasImageCap ? '<span class="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Image</span>' : ''}
                            ${hasVisionCap ? '<span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Vision</span>' : ''}
                        </div>
                        <div class="text-xs text-lamp-muted">${model.provider}</div>
                    </div>
                    ${isSelected ? '<svg class="w-4 h-4 text-lamp-accent" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
                </button>
            `;
        }

        setHtml(this.modelList, html || '<div class="px-3 py-4 text-center text-sm text-lamp-muted">No models available</div>');
    }

    /**
     * Filter models by search query
     * @private
     */
    _filterModels(query) {
        const settings = stateManager.settings;
        // Default to all models enabled if enabledModels is undefined, null, empty, or contains no valid IDs
        const enabledModelIds = settings?.enabledModels;
        const validModelIds = MODELS.map(m => m.id);
        const hasValidEnabled = enabledModelIds && enabledModelIds.length > 0 && 
            enabledModelIds.some(id => validModelIds.includes(id));
        const enabledModels = hasValidEnabled 
            ? MODELS.filter(m => enabledModelIds.includes(m.id))
            : MODELS; // Show all models by default
        const selectedModel = settings?.selectedModel;
        const lowerQuery = query.toLowerCase();

        const filtered = enabledModels.filter(m =>
            m.name.toLowerCase().includes(lowerQuery) ||
            m.provider.toLowerCase().includes(lowerQuery)
        );

        let html = '';
        for (const model of filtered) {
            const isSelected = model.id === selectedModel;
            const hasImageCap = model.capabilities?.includes('image');
            const hasVisionCap = model.capabilities?.includes('vision');
            
            html += `
                <button type="button" data-model-id="${model.id}" 
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-lamp-input transition-colors ${isSelected ? 'bg-lamp-input' : ''}">
                    <div class="flex-1">
                        <div class="text-sm font-medium flex items-center gap-2">
                            ${model.name}
                            ${hasImageCap ? '<span class="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Image</span>' : ''}
                            ${hasVisionCap ? '<span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Vision</span>' : ''}
                        </div>
                        <div class="text-xs text-lamp-muted">${model.provider}</div>
                    </div>
                    ${isSelected ? '<svg class="w-4 h-4 text-lamp-accent" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
                </button>
            `;
        }

        setHtml(this.modelList, html || '<div class="px-3 py-4 text-center text-sm text-lamp-muted">No models found</div>');
    }

    /**
     * Select a model
     * @private
     */
    async _selectModel(modelId) {
        await stateManager.updateSettings({ selectedModel: modelId });
        this._updateSelectedModel();
        this._renderModelList();
        this.modelDropdown?.classList.add('hidden');
    }

    /**
     * Update selected model display
     * @private
     */
    _updateSelectedModel() {
        const settings = stateManager.settings;
        const model = getModelById(settings?.selectedModel);
        if (this.selectedModelName) {
            this.selectedModelName.textContent = model?.name || 'Select Model';
        }
    }
}

