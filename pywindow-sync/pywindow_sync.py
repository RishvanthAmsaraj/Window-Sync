"""
pywindow-sync - Python wrapper for WindowSync protocol

Synchronizes state across multiple Python processes using file-based storage.
"""

import json
import os
import time
import threading
import uuid
from typing import Any, Callable, Dict, List, Optional


class WindowSync:
    """Python implementation of WindowSync protocol"""
    
    def __init__(self, sync_key: str = "window_sync", debug: bool = False):
        self.sync_key = sync_key
        self.state_key = f"{sync_key}_state"
        self.debug = debug
        self.window_id = f"ws_{uuid.uuid4().hex[:8]}_{int(time.time())}"
        self.window_data = None
        self.windows = []
        self.callbacks = {
            "window_added": [],
            "window_removed": [],
            "state_changed": [],
            "custom": {}
        }
        self.initialized = False
        self._poll_thread = None
        self._stop_polling = False
        
        # File-based storage path
        self.storage_dir = os.path.expanduser("~/.pywindow_sync")
        os.makedirs(self.storage_dir, exist_ok=True)
        self.windows_file = os.path.join(self.storage_dir, f"{sync_key}_windows.json")
        self.state_file = os.path.join(self.storage_dir, f"{sync_key}_state.json")
    
    def _log(self, *args):
        if self.debug:
            print("[pywindow-sync]", *args)
    
    def _load_windows(self) -> List[Dict]:
        try:
            if os.path.exists(self.windows_file):
                with open(self.windows_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            self._log("Error loading windows:", e)
        return []
    
    def _save_windows(self):
        try:
            with open(self.windows_file, 'w') as f:
                json.dump(self.windows, f)
        except Exception as e:
            self._log("Error saving windows:", e)
    
    def init(self, metadata: Dict[str, Any] = None):
        """Initialize this process in the sync pool"""
        if self.initialized:
            return
        
        metadata = metadata or {}
        
        # Load existing windows
        self.windows = self._load_windows()
        
        # Register this window
        self.window_data = {
            "id": self.window_id,
            "shape": self._get_shape(),
            "metadata": metadata,
            "last_seen": time.time()
        }
        
        # Check if already exists (e.g., restart)
        existing = [i for i, w in enumerate(self.windows) if w["id"] == self.window_id]
        if existing:
            self.windows[existing[0]] = self.window_data
        else:
            self.windows.append(self.window_data)
        
        self._save_windows()
        self.initialized = True
        
        # Start polling
        self._start_polling()
        
        self._log("Initialized:", self.window_id)
    
    def _get_shape(self) -> Dict[str, int]:
        """Get current process 'shape' (placeholder for position)"""
        return {
            "x": 0,
            "y": 0,
            "width": 800,
            "height": 600
        }
    
    def _start_polling(self):
        """Start background polling thread"""
        def poll():
            while not self._stop_polling:
                self._update()
                time.sleep(3)  # Poll every 3 seconds
        
        self._poll_thread = threading.Thread(target=poll, daemon=True)
        self._poll_thread.start()
    
    def _update(self):
        """Update window data and check for changes"""
        if not self.initialized:
            return
        
        # Update last_seen
        self.window_data["last_seen"] = time.time()
        
        # Reload windows from file
        current_windows = self._load_windows()
        
        # Check for new windows
        current_ids = {w["id"] for w in current_windows}
        old_ids = {w["id"] for w in self.windows}
        
        # Find added windows
        for window in current_windows:
            if window["id"] not in old_ids and window["id"] != self.window_id:
                self._emit("window_added", {"window": window, "all_windows": current_windows})
        
        # Find removed windows
        for window in self.windows:
            if window["id"] not in current_ids and window["id"] != self.window_id:
                self._emit("window_removed", {"window": window, "all_windows": current_windows})
        
        self.windows = current_windows
        
        # Update our entry
        for i, w in enumerate(self.windows):
            if w["id"] == self.window_id:
                self.windows[i] = self.window_data
                break
        
        self._save_windows()
    
    def get_windows(self) -> List[Dict]:
        """Get all synchronized windows"""
        return self._load_windows()
    
    def get_this_window(self) -> Dict:
        """Get this window's data"""
        return self.window_data
    
    def get_id(self) -> str:
        """Get this window's ID"""
        return self.window_id
    
    def get_window_count(self) -> int:
        """Get number of active windows"""
        return len(self.get_windows())
    
    def is_leader(self) -> bool:
        """Check if this is the oldest window"""
        windows = self.get_windows()
        if not windows:
            return True
        return windows[0]["id"] == self.window_id
    
    def set_state(self, key: str, value: Any):
        """Set shared state"""
        try:
            state = self.get_all_state()
            old_value = state.get(key)
            state[key] = value
            
            with open(self.state_file, 'w') as f:
                json.dump(state, f)
            
            self._emit("state_changed", {
                "key": key,
                "value": value,
                "old_value": old_value,
                "state": state
            })
        except Exception as e:
            self._log("Error setting state:", e)
    
    def get_state(self, key: str) -> Any:
        """Get shared state"""
        return self.get_all_state().get(key)
    
    def get_all_state(self) -> Dict:
        """Get all shared state"""
        try:
            if os.path.exists(self.state_file):
                with open(self.state_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            self._log("Error loading state:", e)
        return {}
    
    def broadcast(self, event_name: str, data: Any):
        """Broadcast event to all windows"""
        # In Python version, we use a simple event file
        event_file = os.path.join(self.storage_dir, f"{self.sync_key}_event.json")
        event_data = {
            "event": event_name,
            "data": {
                "from": self.window_id,
                "data": data,
                "timestamp": time.time()
            }
        }
        
        try:
            with open(event_file, 'w') as f:
                json.dump(event_data, f)
        except Exception as e:
            self._log("Error broadcasting:", e)
    
    def on(self, event: str, callback: Callable):
        """Listen for events"""
        if event in self.callbacks:
            self.callbacks[event].append(callback)
        else:
            if event not in self.callbacks["custom"]:
                self.callbacks["custom"][event] = []
            self.callbacks["custom"][event].append(callback)
    
    def off(self, event: str, callback: Callable):
        """Remove event listener"""
        if event in self.callbacks:
            self.callbacks[event] = [c for c in self.callbacks[event] if c != callback]
        elif event in self.callbacks["custom"]:
            self.callbacks["custom"][event] = [c for c in self.callbacks["custom"][event] if c != callback]
    
    def _emit(self, event: str, data: Any):
        """Emit event to listeners"""
        callbacks = self.callbacks.get(event, [])
        for callback in callbacks:
            try:
                callback(data)
            except Exception as e:
                self._log(f"Error in {event} handler:", e)
        
        # Check custom events
        if event in self.callbacks["custom"]:
            for callback in self.callbacks["custom"][event]:
                try:
                    callback(data.get("data"), data.get("from"), data.get("timestamp"))
                except Exception as e:
                    self._log(f"Error in custom {event} handler:", e)
    
    def destroy(self):
        """Clean up and remove from sync pool"""
        self._stop_polling = True
        
        if self._poll_thread:
            self._poll_thread.join(timeout=1)
        
        # Remove this window
        self.windows = [w for w in self.windows if w["id"] != self.window_id]
        self._save_windows()
        
        self.initialized = False
        self._log("Destroyed:", self.window_id)


# Example usage
if __name__ == "__main__":
    sync = WindowSync(debug=True)
    sync.init(metadata={"process": "test"})
    
    @sync.on("window_added")
    def on_added(data):
        print(f"Window added: {data['window']['id']}")
    
    print(f"Windows: {sync.get_window_count()}")
    print(f"Leader: {sync.is_leader()}")
    
    sync.broadcast("test", {"message": "Hello!"})
    
    time.sleep(5)
    sync.destroy()
