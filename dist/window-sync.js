(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.WindowSync = factory());
})(this, (function () { 'use strict';

  /**
   * WindowSync - Cross-Window State Synchronization Library
   * 
   * Synchronizes state across multiple browser windows/tabs using
   * BroadcastChannel API with localStorage fallback for Safari < 15.4
   * 
   * @version 1.1.1
   * @author Rishvanth Amsaraj
   * @license MIT
   */

  class WindowSync {
    #windows;
    #windowId;
    #windowData;
    #syncKey;
    #stateKey;
    #callbacks;
    #pollInterval;
    #heartbeatInterval;
    #initialized;
    #lastShape;
    #channel;
    #useBroadcastChannel;

    /**
     * Create a new WindowSync instance
     * @param {Object} options - Configuration options
     * @param {string} options.syncKey - localStorage key for window sync (default: 'window_sync')
     * @param {number} options.updateInterval - Position check interval in ms (default: 100)
     * @param {boolean} options.debug - Enable debug logging (default: false)
     */
    constructor(options = {}) {
      this.#syncKey = options.syncKey || 'window_sync';
      this.#stateKey = `${this.#syncKey}_state`;
      this.#callbacks = {
        windowAdded: [],
        windowRemoved: [],
        windowMoved: [],
        windowResized: [],
        stateChanged: [],
        custom: {}
      };
      this.#initialized = false;
      this.#windowId = this.#generateId();
      this.debug = options.debug || false;

      // Try BroadcastChannel first (better cross-tab support)
      this.#useBroadcastChannel = false;
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          this.#channel = new BroadcastChannel(this.#syncKey);
          this.#channel.onmessage = (event) => this.#handleBroadcastMessage(event.data);
          this.#useBroadcastChannel = true;
          this.#log('Using BroadcastChannel');
        }
      } catch (err) {
        this.#log('BroadcastChannel not available, using localStorage fallback');
      }

      // Fallback to localStorage storage events
      if (!this.#useBroadcastChannel) {
        window.addEventListener('storage', (event) => this.#handleStorageChange(event));
      }

      // Clean up when window closes
      window.addEventListener('beforeunload', () => this.destroy());

      // Handle page visibility changes
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.#initialized) {
          this.#heartbeat();
        }
      });
    }

    /**
     * Initialize this window in the sync pool
     * @param {Object} metadata - Custom metadata for this window
     * @returns {WindowSync} - Returns this for chaining
     */
    init(metadata = {}) {
      if (this.#initialized) {
        console.warn('[WindowSync] Already initialized');
        return this;
      }

      // Load existing windows from localStorage and clean up stale ones
      this.#windows = this.#cleanStaleWindows(this.#loadWindows());

      // Register this window
      this.#windowData = {
        id: this.#windowId,
        shape: this.#getWindowShape(),
        metadata: metadata,
        lastSeen: Date.now()
      };
      this.#lastShape = JSON.stringify(this.#windowData.shape);

      // Check if we're already in the list (e.g., page reload)
      const existingIndex = this.#windows.findIndex(w => w.id === this.#windowId);
      if (existingIndex !== -1) {
        this.#windows[existingIndex] = this.#windowData;
      } else {
        this.#windows.push(this.#windowData);
      }
      
      this.#saveWindows();
      this.#initialized = true;

      // Start polling for window changes (position/size)
      this.#startPolling();
      
      // Start heartbeat to keep window alive in the list
      this.#startHeartbeat();

      // Notify other windows about this new window
      this.#broadcast({
        type: 'windowAdded',
        window: this.#windowData
      });

      // Request other windows to announce themselves
      this.#broadcast({
        type: 'requestWindows',
        requesterId: this.#windowId
      });

      // Notify local listeners about existing windows
      this.#windows.forEach(w => {
        if (w.id !== this.#windowId) {
          this.#emit('windowAdded', { window: w, allWindows: this.#windows });
        }
      });

      this.#log('Initialized window:', this.#windowId.slice(-8), 'Total windows:', this.#windows.length);

      return this;
    }

    /**
     * Get all synchronized windows
     * @returns {Array} - Array of window data objects
     */
    getWindows() {
      // Always refresh from localStorage to catch updates from other windows
      // that might have been missed via BroadcastChannel
      if (this.#initialized) {
        const stored = this.#loadWindows();
        // Merge stored windows with our current list, keeping our own window data
        const merged = [...stored];
        const ourIndex = merged.findIndex(w => w.id === this.#windowId);
        if (ourIndex !== -1) {
          merged[ourIndex] = this.#windowData;
        }
        this.#windows = this.#cleanStaleWindows(merged);
      }
      return this.#windows || [];
    }

    /**
     * Get this window's data
     * @returns {Object} - This window's data
     */
    getThisWindow() {
      return this.#windowData;
    }

    /**
     * Get this window's ID
     * @returns {string} - Window ID
     */
    getId() {
      return this.#windowId;
    }

    /**
     * Update this window's metadata
     * @param {Object} metadata - New metadata (merged with existing)
     */
    updateMetadata(metadata) {
      if (!this.#initialized) {
        console.warn('[WindowSync] Not initialized');
        return;
      }

      this.#windowData.metadata = { ...this.#windowData.metadata, ...metadata };
      this.#windowData.lastSeen = Date.now();
      this.#updateWindowData();
    }

    /**
     * Set custom state that syncs across all windows
     * @param {string} key - State key
     * @param {*} value - State value (must be JSON serializable)
     */
    setState(key, value) {
      if (!this.#initialized) {
        console.warn('[WindowSync] Not initialized');
        return;
      }

      try {
        const state = this.getAllState();
        const oldValue = state[key];
        state[key] = value;
        localStorage.setItem(this.#stateKey, JSON.stringify(state));

        // Broadcast state change to other windows
        this.#broadcast({
          type: 'stateChanged',
          data: { key, value, oldValue, state, windowId: this.#windowId }
        });

        this.#emit('stateChanged', { key, value, oldValue, state, windowId: this.#windowId });
      } catch (err) {
        console.error('[WindowSync] Failed to set state:', err);
      }
    }

    /**
     * Get shared state
     * @param {string} key - State key
     * @returns {*} - State value
     */
    getState(key) {
      return this.getAllState()[key];
    }

    /**
     * Get all shared state
     * @returns {Object} - All state
     */
    getAllState() {
      try {
        return JSON.parse(localStorage.getItem(this.#stateKey) || '{}');
      } catch {
        return {};
      }
    }

    /**
     * Remove state key
     * @param {string} key - State key to remove
     */
    removeState(key) {
      const state = this.getAllState();
      delete state[key];
      localStorage.setItem(this.#stateKey, JSON.stringify(state));
    }

    /**
     * Clear all shared state
     */
    clearState() {
      localStorage.removeItem(this.#stateKey);
    }

    /**
     * Send a custom event to all windows
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     */
    broadcast(eventName, data) {
      if (!this.#initialized) {
        console.warn('[WindowSync] Not initialized');
        return;
      }

      this.#broadcast({
        type: 'customEvent',
        eventName: eventName,
        data: {
          from: this.#windowId,
          data: data,
          timestamp: Date.now()
        }
      });

      // Trigger for same-window listeners
      this.#handleCustomEvent(eventName, {
        from: this.#windowId,
        data: data,
        timestamp: Date.now()
      });
    }

    /**
     * Register event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
      if (!callback || typeof callback !== 'function') {
        console.warn('[WindowSync] Callback must be a function');
        return;
      }

      if (this.#callbacks[event]) {
        this.#callbacks[event].push(callback);
      } else {
        if (!this.#callbacks.custom[event]) {
          this.#callbacks.custom[event] = [];
        }
        this.#callbacks.custom[event].push(callback);
      }
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback to remove
     */
    off(event, callback) {
      if (this.#callbacks[event]) {
        this.#callbacks[event] = this.#callbacks[event].filter(cb => cb !== callback);
      } else if (this.#callbacks.custom[event]) {
        this.#callbacks.custom[event] = this.#callbacks.custom[event].filter(cb => cb !== callback);
      }
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name
     */
    offAll(event) {
      if (this.#callbacks[event]) {
        this.#callbacks[event] = [];
      } else if (this.#callbacks.custom[event]) {
        delete this.#callbacks.custom[event];
      }
    }

    /**
     * Check if this window is the "leader" (oldest window)
     * @returns {boolean}
     */
    isLeader() {
      const windows = this.getWindows();
      if (!windows || windows.length === 0) return true;
      return windows[0]?.id === this.#windowId;
    }

    /**
     * Get window count
     * @returns {number}
     */
    getWindowCount() {
      return this.getWindows().length;
    }

    /**
     * Destroy this WindowSync instance and clean up
     */
    destroy() {
      if (!this.#initialized) return;

      this.#stopPolling();
      this.#stopHeartbeat();
      this.#removeWindow();
      
      // Broadcast removal
      this.#broadcast({
        type: 'windowRemoved',
        windowId: this.#windowId
      });

      // Close BroadcastChannel
      if (this.#channel) {
        this.#channel.close();
      }

      this.#initialized = false;
      this.#log('Destroyed window:', this.#windowId.slice(-8));
    }

    // Private methods

    #generateId() {
      return 'ws_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    }

    #getWindowShape() {
      return {
        x: window.screenX ?? window.screenLeft ?? 0,
        y: window.screenY ?? window.screenTop ?? 0,
        width: window.innerWidth,
        height: window.innerHeight,
        screenWidth: window.screen?.width || 0,
        screenHeight: window.screen?.height || 0
      };
    }

    #loadWindows() {
      try {
        return JSON.parse(localStorage.getItem(this.#syncKey) || '[]');
      } catch {
        return [];
      }
    }

    #saveWindows() {
      try {
        localStorage.setItem(this.#syncKey, JSON.stringify(this.#windows));
      } catch (err) {
        console.error('[WindowSync] Failed to save windows:', err);
      }
    }

    #updateWindowData() {
      const index = this.#windows.findIndex(w => w.id === this.#windowId);
      if (index !== -1) {
        this.#windows[index] = this.#windowData;
        this.#saveWindows();
        
        // Broadcast update to other windows
        this.#broadcast({
          type: 'windowUpdated',
          window: this.#windowData
        });
      }
    }

    #removeWindow() {
      if (!this.#windows) return;
      this.#windows = this.#windows.filter(w => w.id !== this.#windowId);
      this.#saveWindows();
    }

    #cleanStaleWindows(windows) {
      const now = Date.now();
      const staleThreshold = 10000; // 10 seconds (increased from 5)
      return windows.filter(w => (now - w.lastSeen) < staleThreshold);
    }

    #heartbeat() {
      if (!this.#initialized) return;
      this.#windowData.lastSeen = Date.now();
      this.#updateWindowData();
    }

    #startPolling() {
      this.#pollInterval = setInterval(() => {
        if (!this.#initialized) return;

        const newShape = this.#getWindowShape();
        const shapeStr = JSON.stringify(newShape);

        if (shapeStr !== this.#lastShape) {
          const oldShape = this.#windowData.shape;
          this.#windowData.shape = newShape;
          this.#windowData.lastSeen = Date.now();
          this.#lastShape = shapeStr;
          this.#updateWindowData();

          const moved = newShape.x !== oldShape.x || newShape.y !== oldShape.y;
          const resized = newShape.width !== oldShape.width || newShape.height !== oldShape.height;

          if (moved) {
            this.#emit('windowMoved', { window: this.#windowData, oldShape });
          }
          if (resized) {
            this.#emit('windowResized', { window: this.#windowData, oldShape });
          }
        }
      }, 100);
    }

    #stopPolling() {
      if (this.#pollInterval) {
        clearInterval(this.#pollInterval);
        this.#pollInterval = null;
      }
    }
    
    #startHeartbeat() {
      // Send heartbeat every 3 seconds to keep window alive
      this.#heartbeatInterval = setInterval(() => {
        if (!this.#initialized) return;
        
        this.#windowData.lastSeen = Date.now();
        this.#saveWindows();
        
        // Also broadcast heartbeat so other windows update their lists
        this.#broadcast({
          type: 'heartbeat',
          window: this.#windowData
        });
      }, 3000);
    }
    
    #stopHeartbeat() {
      if (this.#heartbeatInterval) {
        clearInterval(this.#heartbeatInterval);
        this.#heartbeatInterval = null;
      }
    }

    #broadcast(message) {
      if (this.#useBroadcastChannel && this.#channel) {
        this.#channel.postMessage(message);
      } else {
        // Fallback: use localStorage to trigger storage event
        const eventKey = `${this.#syncKey}_event_${Date.now()}`;
        localStorage.setItem(eventKey, JSON.stringify(message));
        setTimeout(() => localStorage.removeItem(eventKey), 100);
      }
    }

    #handleBroadcastMessage(message) {
      if (!message || !message.type) return;
      
      this.#log('Received broadcast:', message.type, 'from', message.window?.id?.slice(-8) || message.windowId?.slice(-8) || 'unknown');

      switch (message.type) {
        case 'windowAdded':
          if (message.window && message.window.id !== this.#windowId) {
            // Add window if not already in list
            const exists = this.#windows.some(w => w.id === message.window.id);
            if (!exists) {
              this.#windows.push(message.window);
              this.#saveWindows(); // Persist to localStorage too
              this.#emit('windowAdded', { window: message.window, allWindows: this.#windows });
              this.#log('Added window from broadcast:', message.window.id.slice(-8), 'Total:', this.#windows.length);
            }
          }
          break;

        case 'windowRemoved':
          if (message.windowId && message.windowId !== this.#windowId) {
            const removed = this.#windows.find(w => w.id === message.windowId);
            this.#windows = this.#windows.filter(w => w.id !== message.windowId);
            this.#saveWindows(); // Persist to localStorage too
            if (removed) {
              this.#emit('windowRemoved', { window: removed, allWindows: this.#windows });
              this.#log('Removed window from broadcast:', message.windowId.slice(-8));
            }
          }
          break;
          
        case 'requestWindows':
          // Someone is asking for windows - announce ourselves
          if (message.requesterId !== this.#windowId) {
            this.#broadcast({
              type: 'windowAdded',
              window: this.#windowData
            });
            this.#log('Announced myself to:', message.requesterId.slice(-8));
          }
          break;
          
        case 'heartbeat':
          if (message.window && message.window.id !== this.#windowId) {
            const index = this.#windows.findIndex(w => w.id === message.window.id);
            if (index !== -1) {
              this.#windows[index] = message.window;
              this.#saveWindows();
            } else {
              // Window not in our list - add it
              this.#windows.push(message.window);
              this.#saveWindows();
              this.#emit('windowAdded', { window: message.window, allWindows: this.#windows });
              this.#log('Added window from heartbeat:', message.window.id.slice(-8));
            }
          }
          break;

        case 'windowUpdated':
          if (message.window && message.window.id !== this.#windowId) {
            const index = this.#windows.findIndex(w => w.id === message.window.id);
            if (index !== -1) {
              this.#windows[index] = message.window;
            }
          }
          break;

        case 'stateChanged':
          if (message.data && message.data.windowId !== this.#windowId) {
            this.#emit('stateChanged', message.data);
          }
          break;

        case 'customEvent':
          if (message.data && message.data.from !== this.#windowId) {
            this.#handleCustomEvent(message.eventName, message.data);
          }
          break;
      }
    }

    #handleStorageChange(event) {
      if (event.key?.startsWith(`${this.#syncKey}_event_`)) {
        try {
          const message = JSON.parse(event.newValue);
          this.#handleBroadcastMessage(message);
        } catch (err) {
          console.error('[WindowSync] Failed to parse storage event:', err);
        }
      }
    }

    #handleCustomEvent(eventName, eventData) {
      const callbacks = this.#callbacks.custom[eventName];
      if (callbacks) {
        callbacks.forEach(cb => {
          try {
            cb(eventData.data, eventData.from, eventData.timestamp);
          } catch (err) {
            console.error(`[WindowSync] Error in '${eventName}' handler:`, err);
          }
        });
      }
    }

    #emit(event, data) {
      const callbacks = this.#callbacks[event];
      if (callbacks) {
        callbacks.forEach(cb => {
          try {
            cb(data);
          } catch (err) {
            console.error(`[WindowSync] Error in '${event}' handler:`, err);
          }
        });
      }
    }

    #log(...args) {
      if (this.debug) {
        console.log('[WindowSync]', ...args);
      }
    }
  }

  // Export for different module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WindowSync;
  }

  if (typeof window !== 'undefined') {
    window.WindowSync = WindowSync;
  }

  return WindowSync;

}));
