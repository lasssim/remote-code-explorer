import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Helper to get MIME types
function getMimeType(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// API Handlers
async function getFileTree(dir = '.') {
  const targetDir = path.resolve(process.cwd(), dir);
  
  async function buildTree(currentPath, relativePath = '') {
    const stats = await fs.stat(currentPath);
    const name = path.basename(currentPath);
    
    // Skip hidden files and common ignore patterns
    if (name.startsWith('.') || name === 'node_modules') {
      return null;
    }
    
    if (stats.isFile()) {
      return {
        name,
        type: 'file',
        path: relativePath || name
      };
    } else if (stats.isDirectory()) {
      const children = await fs.readdir(currentPath);
      const childNodes = await Promise.all(
        children.map(child => 
          buildTree(
            path.join(currentPath, child),
            path.join(relativePath, child)
          )
        )
      );
      
      return {
        name,
        type: 'directory',
        path: relativePath || name,
        children: childNodes.filter(node => node !== null)
      };
    }
    
    return null;
  }
  
  try {
    const tree = await buildTree(targetDir, '.');
    return tree;
  } catch (error) {
    console.error('Error building file tree:', error);
    throw error;
  }
}

async function getGitStatus() {
  try {
    // Check if we're in a git repository
    await execAsync('git rev-parse --git-dir');
    
    // Get status in porcelain format for easier parsing
    const { stdout } = await execAsync('git status --porcelain');
    
    const files = stdout.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const status = line.substring(0, 2);
        const filepath = line.substring(3);
        
        let type = 'modified';
        if (status.includes('A')) type = 'added';
        else if (status.includes('D')) type = 'deleted';
        else if (status.includes('M')) type = 'modified';
        else if (status.includes('?')) type = 'untracked';
        
        return { filepath, status: type };
      });
    
    return { files };
  } catch (error) {
    return { files: [], error: 'Not a git repository or git not available' };
  }
}

async function getFileDiff(filepath) {
  try {
    // Try to get diff for the file
    let command = `git diff HEAD -- "${filepath}"`;
    
    // If file is untracked, show the full content
    const { stdout: statusOut } = await execAsync(`git status --porcelain "${filepath}"`);
    if (statusOut.startsWith('??')) {
      const content = await fs.readFile(filepath, 'utf-8');
      return { 
        diff: `--- /dev/null\n+++ b/${filepath}\n` + 
              content.split('\n').map(line => '+' + line).join('\n'),
        isNew: true
      };
    }
    
    const { stdout } = await execAsync(command);
    return { diff: stdout, isNew: false };
  } catch (error) {
    return { diff: '', error: error.message };
  }
}

async function getFileContent(filepath) {
  try {
    const fullPath = path.resolve(process.cwd(), filepath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return { content };
  } catch (error) {
    return { content: '', error: error.message };
  }
}

// Request handler
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // API Routes
  if (url.pathname === '/api/files') {
    try {
      const tree = await getFileTree();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tree));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
  if (url.pathname === '/api/git/status') {
    try {
      const status = await getGitStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
  if (url.pathname === '/api/git/diff') {
    const filepath = url.searchParams.get('file');
    if (!filepath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File parameter is required' }));
      return;
    }
    
    try {
      const diff = await getFileDiff(filepath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(diff));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
  if (url.pathname === '/api/file/content') {
    const filepath = url.searchParams.get('path');
    if (!filepath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Path parameter is required' }));
      return;
    }
    
    try {
      const content = await getFileContent(filepath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(content));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
  // Static file serving
  let filepath = url.pathname === '/' ? '/public/index.html' : `/public${url.pathname}`;
  filepath = path.join(__dirname, filepath);
  
  try {
    const content = await fs.readFile(filepath);
    const mimeType = getMimeType(filepath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    }
  }
}

// Create and start server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Remote Code Explorer running at http://localhost:${PORT}`);
  console.log(`Serving files from: ${process.cwd()}`);
});
