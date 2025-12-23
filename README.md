# Remote Code Explorer

A web-based file explorer and git changes viewer that replicates the VSCode file explorer and git source control panel.

## Features

- **File Explorer**: Browse your project's file structure in a tree view
- **Git Source Control**: View modified, added, deleted, and untracked files
- **Diff Viewer**: View file differences with syntax highlighting
- **Multiple Tabs**: Open and switch between multiple files
- **VSCode-inspired UI**: Dark theme matching VSCode aesthetics

## Installation

```bash
npm install
```

## Usage

Run the server from your project directory:

```bash
npm start
```

Then open your browser to `http://localhost:3000`

The server will expose the current working directory and its git status.

## Development

The application is built with:
- Node.js (built-in HTTP server)
- Vanilla JavaScript (ES6 modules)
- CSS3 (VSCode-inspired theme)

## Future Features

- File editing capabilities
- Git staging and commit functionality
- Integration with code agents (e.g., Claude)

## Project Structure

```
remote-code-explorer/
├── server.js           # Node.js HTTP server with API endpoints
├── public/
│   ├── index.html     # Main HTML structure
│   ├── styles.css     # VSCode-inspired styling
│   └── app.js         # Frontend application logic
└── package.json       # Project dependencies
```

## API Endpoints

- `GET /api/files` - Returns the file tree structure
- `GET /api/git/status` - Returns git status (modified/added/deleted files)
- `GET /api/git/diff?file=<path>` - Returns diff for a specific file
- `GET /api/file/content?path=<path>` - Returns file content
