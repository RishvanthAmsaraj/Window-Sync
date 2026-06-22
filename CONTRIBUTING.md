# Contributing to WindowSync

Thank you for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/RishvanthAmsaraj/Window-Sync.git
cd Window-Sync
npm install
```

## Building

```bash
npm run build
```

This creates:
- `dist/window-sync.js` - UMD build
- `dist/window-sync.min.js` - Minified UMD
- `dist/window-sync.esm.js` - ES Module build

## Testing

Open `examples/basic-demo.html` in multiple browser windows to test.

## Project Structure

```
Window-Sync/
├── src/
│   └── WindowSync.js          # Main library
├── dist/                       # Built files
├── examples/                   # Demo pages
│   ├── basic-demo.html
│   ├── spheres-demo.html
│   └── ...
├── tests/                      # Test files (TODO)
├── API.md                      # API documentation
└── README.md
```

## Adding Features

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Build: `npm run build`
5. Test in multiple windows
6. Submit a pull request

## Code Style

- Use ES6+ features
- Private methods with `#` prefix
- JSDoc comments for public API
- No external dependencies

## Reporting Issues

Please include:
- Browser version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
