// Base Component Class
// ====================
// Provides lifecycle management and automatic cleanup for vanilla JS components.
// Helps prevent memory leaks by tracking and cleaning up event listeners.

/**
 * @typedef {Object} EventBinding
 * @property {EventTarget} target - The event target (element)
 * @property {string} type - Event type (e.g., 'click')
 * @property {Function} handler - Event handler function
 * @property {Object} [options] - Event listener options
 */

/**
 * Base component class with lifecycle management
 * 
 * Features:
 * - Automatic event listener cleanup on destroy
 * - State subscription management
 * - Consistent lifecycle hooks
 * - Memory leak prevention
 * 
 * Usage:
 * ```js
 * class MyComponent extends Component {
 *   init(containerId) {
 *     super.init(containerId);
 *     this._render();
 *     this._bindEvents();
 *   }
 *   
 *   _bindEvents() {
 *     // Use this.on() instead of addEventListener
 *     this.on(this.elements.button, 'click', this._handleClick);
 *   }
 * }
 * ```
 */
export class Component {
    constructor() {
        /** @type {HTMLElement|null} */
        this.container = null;

        /** @type {Object<string, HTMLElement>} */
        this.elements = {};

        /** @type {EventBinding[]} */
        this._eventBindings = [];

        /** @type {Function[]} */
        this._unsubscribers = [];

        /** @type {number[]} */
        this._timeoutIds = [];

        /** @type {number[]} */
        this._intervalIds = [];

        /** @type {number[]} */
        this._rafIds = [];

        /** @type {boolean} */
        this._destroyed = false;
    }

    /**
     * Initialize the component
     * @param {string} containerId - Container element ID
     */
    init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container not found: ${containerId}`);
            return;
        }
        this.container = container;
    }

    /**
     * Add an event listener with automatic cleanup tracking
     * @param {EventTarget} target - Event target (element, window, document, etc.)
     * @param {string} type - Event type
     * @param {Function} handler - Event handler
     * @param {Object} [options] - Event listener options
     * @returns {Function} Cleanup function
     */
    on(target, type, handler, options) {
        if (!target || this._destroyed) return () => { };

        // Bind handler to this component instance
        const boundHandler = handler.bind(this);

        target.addEventListener(type, boundHandler, options);

        const binding = { target, type, handler: boundHandler, options };
        this._eventBindings.push(binding);

        // Return cleanup function
        return () => this._removeEventBinding(binding);
    }

    /**
     * Add a delegated event listener
     * @param {EventTarget} target - Parent element to listen on
     * @param {string} type - Event type
     * @param {string} selector - CSS selector for delegated target
     * @param {Function} handler - Event handler (receives matched element and event)
     * @param {Object} [options] - Event listener options
     * @returns {Function} Cleanup function
     */
    onDelegate(target, type, selector, handler, options) {
        if (!target || this._destroyed) return () => { };

        const delegatedHandler = (e) => {
            const matchedElement = e.target.closest(selector);
            if (matchedElement && target.contains(matchedElement)) {
                handler.call(this, matchedElement, e);
            }
        };

        return this.on(target, type, delegatedHandler, options);
    }

    /**
     * Remove a specific event binding
     * @private
     * @param {EventBinding} binding
     */
    _removeEventBinding(binding) {
        binding.target.removeEventListener(binding.type, binding.handler, binding.options);
        const index = this._eventBindings.indexOf(binding);
        if (index > -1) {
            this._eventBindings.splice(index, 1);
        }
    }

    /**
     * Subscribe to state changes with automatic cleanup
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
        if (this._destroyed) return () => { };

        // Import stateManager dynamically to avoid circular deps
        import('../services/state.js').then(({ stateManager }) => {
            const unsubscribe = stateManager.subscribe(event, callback.bind(this));
            this._unsubscribers.push(unsubscribe);
        });

        return () => {
            const index = this._unsubscribers.indexOf(callback);
            if (index > -1) {
                this._unsubscribers[index]?.();
                this._unsubscribers.splice(index, 1);
            }
        };
    }

    /**
     * Set a timeout with automatic cleanup
     * @param {Function} callback
     * @param {number} delay
     * @returns {number} Timeout ID
     */
    setTimeout(callback, delay) {
        if (this._destroyed) return -1;

        const id = window.setTimeout(() => {
            const index = this._timeoutIds.indexOf(id);
            if (index > -1) this._timeoutIds.splice(index, 1);
            callback.call(this);
        }, delay);

        this._timeoutIds.push(id);
        return id;
    }

    /**
     * Set an interval with automatic cleanup
     * @param {Function} callback
     * @param {number} delay
     * @returns {number} Interval ID
     */
    setInterval(callback, delay) {
        if (this._destroyed) return -1;

        const id = window.setInterval(callback.bind(this), delay);
        this._intervalIds.push(id);
        return id;
    }

    /**
     * Request animation frame with automatic cleanup
     * @param {Function} callback
     * @returns {number} RAF ID
     */
    requestAnimationFrame(callback) {
        if (this._destroyed) return -1;

        const id = window.requestAnimationFrame((time) => {
            const index = this._rafIds.indexOf(id);
            if (index > -1) this._rafIds.splice(index, 1);
            callback.call(this, time);
        });

        this._rafIds.push(id);
        return id;
    }

    /**
     * Cache element references by ID
     * @param {string[]} ids - Array of element IDs to cache
     */
    cacheElements(ids) {
        for (const id of ids) {
            this.elements[id] = document.getElementById(id);
        }
    }

    /**
     * Query an element within the container
     * @param {string} selector - CSS selector
     * @returns {HTMLElement|null}
     */
    $(selector) {
        return this.container?.querySelector(selector) || null;
    }

    /**
     * Query all elements within the container
     * @param {string} selector - CSS selector
     * @returns {NodeListOf<HTMLElement>}
     */
    $$(selector) {
        return this.container?.querySelectorAll(selector) || [];
    }

    /**
     * Refresh the component (override in subclass)
     */
    refresh() {
        // Override in subclass
    }

    /**
     * Destroy the component and clean up all resources
     * Call this when removing a component from the DOM
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        // Remove all event listeners
        for (const binding of this._eventBindings) {
            binding.target.removeEventListener(binding.type, binding.handler, binding.options);
        }
        this._eventBindings = [];

        // Unsubscribe from state
        for (const unsubscribe of this._unsubscribers) {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        }
        this._unsubscribers = [];

        // Clear timeouts
        for (const id of this._timeoutIds) {
            window.clearTimeout(id);
        }
        this._timeoutIds = [];

        // Clear intervals
        for (const id of this._intervalIds) {
            window.clearInterval(id);
        }
        this._intervalIds = [];

        // Cancel animation frames
        for (const id of this._rafIds) {
            window.cancelAnimationFrame(id);
        }
        this._rafIds = [];

        // Clear element references
        this.elements = {};
        this.container = null;

        // Call cleanup hook
        this.onDestroy();
    }

    /**
     * Cleanup hook - override in subclass for custom cleanup
     */
    onDestroy() {
        // Override in subclass
    }
}

/**
 * Mixin to add Component lifecycle to existing classes
 * Use this to gradually migrate existing components
 * 
 * @param {Object} instance - Component instance
 */
export function mixinComponentLifecycle(instance) {
    instance._eventBindings = instance._eventBindings || [];
    instance._unsubscribers = instance._unsubscribers || [];
    instance._timeoutIds = instance._timeoutIds || [];
    instance._intervalIds = instance._intervalIds || [];
    instance._rafIds = instance._rafIds || [];
    instance._destroyed = false;

    // Add the on() method
    instance.on = function (target, type, handler, options) {
        if (!target || this._destroyed) return () => { };
        const boundHandler = handler.bind(this);
        target.addEventListener(type, boundHandler, options);
        const binding = { target, type, handler: boundHandler, options };
        this._eventBindings.push(binding);
        return () => {
            target.removeEventListener(type, boundHandler, options);
            const index = this._eventBindings.indexOf(binding);
            if (index > -1) this._eventBindings.splice(index, 1);
        };
    };

    // Add destroy method
    const originalDestroy = instance.destroy?.bind(instance);
    instance.destroy = function () {
        if (this._destroyed) return;
        this._destroyed = true;

        for (const binding of this._eventBindings) {
            binding.target.removeEventListener(binding.type, binding.handler, binding.options);
        }
        this._eventBindings = [];

        for (const unsubscribe of this._unsubscribers) {
            if (typeof unsubscribe === 'function') unsubscribe();
        }
        this._unsubscribers = [];

        for (const id of this._timeoutIds) window.clearTimeout(id);
        this._timeoutIds = [];

        for (const id of this._intervalIds) window.clearInterval(id);
        this._intervalIds = [];

        for (const id of this._rafIds) window.cancelAnimationFrame(id);
        this._rafIds = [];

        if (originalDestroy) originalDestroy();
    };

    return instance;
}
