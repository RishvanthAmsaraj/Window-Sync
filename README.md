# WindowSync

A lightweight library for synchronizing state across multiple browser windows/tabs using BroadcastChannel API with localStorage fallback.

**Version:** 1.1.1 | **License:** MIT

## Features

- **Cross-Window Sync** - Synchronize state, events, and window metadata across browser tabs/windows
- **BroadcastChannel API** - Primary transport for instant communication (Safari 15.4+)
- **localStorage Fallback** - Works in older browsers without BroadcastChannel
- **Window Tracking** - Automatic position, size, and metadata tracking
- **Shared State** - Set/get state that persists across all windows
- **Custom Events** - Broadcast custom events between windows
- **Leader Election** - Determine which window is the "leader" (oldest)
- **Heartbeat System** - Automatic window discovery and keep-alive
- **Zero Dependencies** - Pure JavaScript, no external libraries

## Browser Support

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 60+ | Full support |
| Firefox | 65+ | Full support |
| Safari | 15.4+ | Full support (BroadcastChannel) |
| Safari | 12-15.3 | localStorage fallback |
| Edge | 79+ | Full support |

## Installation

### NPM

```bash
npm install @rishvanth/window-sync
```

### CDN

```html
<script src="https://unpkg.com/@rishvanth/window-sync/dist/window-sync.min.js"></script>
```

### ES Modules

```javascript
import WindowSync from '@rishvanth/window-sync';
```

## Quick Start

```html
<script src="https://unpkg.com/@rishvanth/window-sync/dist/window-sync.min.js"></script>
<script>
  // Create instance
  const sync = new WindowSync({ syncKey: 'my_app' });
  
  // Initialize this window
  sync.init({ name: 'Window 1' });
  
  // Listen for new windows
  sync.on('windowAdded', ({ window, allWindows }) => {
    console.log('New window:', window.id);
    console.log('Total windows:', allWindows.length);
  });
  
  // Share state
  sync.setState('theme', 'dark');
  
  // Get state in another window
  const theme = sync.getState('theme'); // 'dark'
  
  // Broadcast custom events
  sync.broadcast('message', { text: 'Hello!' });
  
  sync.on('message', (data, fromWindowId) => {
    console.log('Received:', data.text);
  });
</script>
```

## API Reference

### Constructor

```javascript
const sync = new WindowSync({
  syncKey: 'my_app_sync',      // Unique key for this app
  updateInterval: 100,          // Position check interval (ms)
  debug: false                  // Enable debug logging
});
```

### Methods

| Method | Description |
|--------|-------------|
| `init(metadata)` | Initialize this window in the sync pool |
| `getWindows()` | Get all synchronized windows |
| `getThisWindow()` | Get this window's data |
| `getId()` | Get this window's unique ID |
| `updateMetadata(metadata)` | Update this window's metadata |
| `setState(key, value)` | Set shared state |
| `getState(key)` | Get shared state |
| `getAllState()` | Get all shared state |
| `removeState(key)` | Remove state key |
| `clearState()` | Clear all shared state |
| `broadcast(eventName, data)` | Send event to all windows |
| `on(event, callback)` | Listen for events |
| `off(event, callback)` | Remove listener |
| `offAll(event)` | Remove all listeners for event |
| `isLeader()` | Check if this is the oldest window |
| `getWindowCount()` | Get number of windows |
| `destroy()` | Clean up and remove window |

### Events

| Event | Description | Callback Data |
|-------|-------------|---------------|
| `windowAdded` | New window joined | `{ window, allWindows }` |
| `windowRemoved` | Window closed | `{ window, allWindows }` |
| `windowMoved` | Window position changed | `{ window, oldShape }` |
| `windowResized` | Window size changed | `{ window, oldShape }` |
| `stateChanged` | Shared state updated | `{ key, value, oldValue, state }` |
| `custom` | Custom broadcast events | `(data, fromWindowId)` |

## How It Works

### Primary Transport: BroadcastChannel

Modern browsers (Safari 15.4+, Chrome 60+, Firefox 65+) use the BroadcastChannel API:

1. Each WindowSync instance creates a BroadcastChannel with the same name
2. Messages are instantly broadcast to all connected windows
3. No polling needed for basic communication

### Fallback: localStorage

Older browsers use localStorage storage events:

1. Window data stored in localStorage
2. Storage events fire when other windows modify data
3. Polling detects window movement/resizing

### Window Discovery

WindowSync uses a heartbeat system for reliable discovery:

1. **Initialization** - New windows broadcast their presence and request existing windows to announce themselves
2. **Heartbeat** - Every 3 seconds, windows broadcast a heartbeat to maintain presence
3. **Stale Cleanup** - Windows that haven't sent a heartbeat in 10 seconds are removed
4. **localStorage Sync** - Window list is persisted to localStorage as a backup

## Examples

### Basic Demo

Open `examples/basic-demo.html` in multiple windows to see:
- Window position/size tracking
- Real-time window count
- Message broadcasting

### Multi-Window Pong

Open `examples/pong-game.html` in 2-3 windows:
- Each window is a player
- Ball travels between windows
- Move mouse to control paddle

## Use Cases

- **Multi-Window Dashboards** - Spread widgets across monitors
- **Collaborative Tools** - Real-time collaboration without WebSockets
- **Multi-Window Games** - Games spanning multiple windows
- **Development Tools** - Debug panels across windows
- **Presentation Tools** - Control slides from separate window

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Acknowledgments

- Inspired by [bgstaal/multipleWindow3dScene](https://github.com/bgstaal/multipleWindow3dScene)
- Uses BroadcastChannel API for reliable cross-tab communication
