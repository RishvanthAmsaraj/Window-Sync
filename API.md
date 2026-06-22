# WindowSync API Reference

## Installation

### Browser (CDN)
```html
<script src="https://cdn.jsdelivr.net/npm/@rishvanth/window-sync/dist/window-sync.min.js"></script>
```

### NPM
```bash
npm install @rishvanth/window-sync
```

```javascript
import WindowSync from '@rishvanth/window-sync';
```

## Quick Start

```javascript
const sync = new WindowSync();
sync.init();

// Listen for window changes
sync.on('windowAdded', (data) => {
    console.log('New window:', data.window.id);
});

// Broadcast to all windows
sync.broadcast('message', { text: 'Hello!' });
```

## Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `syncKey` | string | `'window_sync'` | localStorage key prefix |
| `debug` | boolean | `false` | Enable console logging |

## Methods

### `init(metadata)`
Initialize this window in the sync pool.
- `metadata` (Object): Custom data to attach to this window

### `getWindows()`
Get all synchronized windows.
- Returns: `Array<WindowData>`

### `getThisWindow()`
Get this window's data.
- Returns: `WindowData`

### `getId()`
Get this window's unique ID.
- Returns: `string`

### `getWindowCount()`
Get number of active windows.
- Returns: `number`

### `isLeader()`
Check if this is the oldest window (leader).
- Returns: `boolean`

### `updateMetadata(metadata)`
Update this window's metadata.
- `metadata` (Object): Data to merge

### `setState(key, value)`
Set shared state across all windows.
- `key` (string): State key
- `value` (any): JSON-serializable value

### `getState(key)`
Get shared state.
- `key` (string): State key
- Returns: `any`

### `getAllState()`
Get all shared state.
- Returns: `Object`

### `broadcast(eventName, data)`
Send custom event to all windows.
- `eventName` (string): Event name
- `data` (any): Event data

### `on(event, callback)`
Listen for events.
- `event` (string): Event name
- `callback` (Function): Event handler

### `off(event, callback)`
Remove event listener.

### `destroy()`
Clean up and remove this window from sync pool.

## Events

### `windowAdded`
Fired when a new window joins.
```javascript
sync.on('windowAdded', ({ window, allWindows }) => {
    // window: New window data
    // allWindows: Array of all windows
});
```

### `windowRemoved`
Fired when a window leaves.
```javascript
sync.on('windowRemoved', ({ window, allWindows }) => {
    // window: Removed window data
    // allWindows: Array of remaining windows
});
```

### `windowMoved`
Fired when a window moves.
```javascript
sync.on('windowMoved', ({ window, oldShape }) => {
    // window: Updated window data
    // oldShape: Previous position/size
});
```

### `windowResized`
Fired when a window resizes.
```javascript
sync.on('windowResized', ({ window, oldShape }) => {
    // window: Updated window data
    // oldShape: Previous position/size
});
```

### `stateChanged`
Fired when shared state changes.
```javascript
sync.on('stateChanged', ({ key, value, oldValue, state }) => {
    // key: Changed state key
    // value: New value
    // oldValue: Previous value
    // state: All current state
});
```

### Custom Events
Listen for broadcasted events:
```javascript
sync.on('myEvent', (data, fromWindowId, timestamp) => {
    // data: Broadcast data
    // fromWindowId: Sender's ID
    // timestamp: Send time
});
```

## Window Data Structure

```typescript
interface WindowData {
    id: string;           // Unique window ID
    shape: {
        x: number;        // Screen X position
        y: number;        // Screen Y position
        width: number;    // Window width
        height: number;   // Window height
    };
    metadata: object;     // Custom metadata
    lastSeen: number;     // Last activity timestamp
}
```

## Examples

### Basic Setup
```javascript
const sync = new WindowSync({ syncKey: 'my_app' });
sync.init({ page: 'home' });
```

### Leader Election
```javascript
if (sync.isLeader()) {
    // Only leader runs this code
    startGameServer();
}
```

### Cross-Window State
```javascript
// In Window A
sync.setState('user', { name: 'John', id: 123 });

// In Window B
sync.on('stateChanged', ({ key }) => {
    if (key === 'user') {
        const user = sync.getState('user');
        console.log('User updated:', user);
    }
});
```

### Window Position Tracking
```javascript
sync.on('windowMoved', ({ window }) => {
    console.log(`Window ${window.id} moved to:`,
        window.shape.x, window.shape.y);
});
```

## Python Library

For Python applications, see `pywindow-sync` package:

```bash
pip install pywindow-sync
```

```python
from pywindow_sync import WindowSync

sync = WindowSync(sync_key="my_app")
sync.init()

@sync.on("window_added")
def handle_window(data):
    print(f"New window: {data['window']['id']}")

sync.broadcast("message", {"text": "Hello from Python!"})
```
