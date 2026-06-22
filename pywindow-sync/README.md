# pywindow-sync

Python wrapper for WindowSync protocol.

## Installation

```bash
pip install pywindow-sync
```

## Usage

```python
from pywindow_sync import WindowSync

# Create instance
sync = WindowSync(sync_key="my_app")

# Initialize
sync.init(metadata={"process": "worker1"})

# Listen for events
@sync.on("window_added")
def on_window_added(data):
    print(f"New window: {data['window']['id']}")

@sync.on("window_removed")
def on_window_removed(data):
    print(f"Window removed: {data['window']['id']}")

@sync.on("custom_event")
def on_custom_event(data, from_id, timestamp):
    print(f"Received: {data} from {from_id}")

# Broadcast to all windows
sync.broadcast("custom_event", {"message": "Hello!"})

# Get all windows
windows = sync.get_windows()
print(f"Active windows: {len(windows)}")

# Check if leader
if sync.is_leader():
    print("This is the leader process")

# Cleanup
sync.destroy()
```

## Features

- Cross-process synchronization
- Shared state management
- Event broadcasting
- Leader election
- Window/process tracking

## Requirements

- Python 3.7+
- No external dependencies (uses built-in libraries)
