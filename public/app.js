// State management
const state = {
  fileTree: null,
  gitChanges: [],
  openTabs: [],
  activeTab: null,
  expandedDirectories: new Set()
};

// API calls
async function fetchFileTree() {
  const response = await fetch('/api/files');
  const data = await response.json();
  return data;
}

async function fetchGitStatus() {
  const response = await fetch('/api/git/status');
  const data = await response.json();
  return data;
}

async function fetchFileDiff(filepath) {
  const response = await fetch(`/api/git/diff?path=${encodeURIComponent(filepath)}`);
  const data = await response.json();
  return data;
}

async function fetchFileContent(filepath) {
  const response = await fetch(`/api/file/content?path=${encodeURIComponent(filepath)}`);
  const data = await response.json();
  return data;
}

// UI Rendering functions
function renderFileTree(node, container, level = 0) {
  if (!node) return;
  
  const item = document.createElement('div');
  item.className = `tree-item ${node.type}`;
  item.style.paddingLeft = `${level * 12 + 8}px`;
  
  const icon = document.createElement('span');
  icon.className = 'tree-item-icon';
  
  const label = document.createElement('span');
  label.className = 'tree-item-label';
  label.textContent = node.name;
  
  item.appendChild(icon);
  item.appendChild(label);
  container.appendChild(item);
  
  if (node.type === 'directory') {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    container.appendChild(childrenContainer);
    
    // Check if directory should be expanded
    if (state.expandedDirectories.has(node.path)) {
      item.classList.add('expanded');
      childrenContainer.classList.add('expanded');
    }
    
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDirectory(item, childrenContainer, node);
    });
    
    // Render children if expanded
    if (node.children && state.expandedDirectories.has(node.path)) {
      node.children.forEach(child => renderFileTree(child, childrenContainer, level + 1));
    }
  } else {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      openFile(node.path, 'file');
    });
  }
}

function toggleDirectory(item, childrenContainer, node) {
  const isExpanded = item.classList.contains('expanded');
  
  if (isExpanded) {
    item.classList.remove('expanded');
    childrenContainer.classList.remove('expanded');
    state.expandedDirectories.delete(node.path);
  } else {
    item.classList.add('expanded');
    childrenContainer.classList.add('expanded');
    state.expandedDirectories.add(node.path);
    
    // Render children if not already rendered
    if (childrenContainer.children.length === 0 && node.children) {
      node.children.forEach(child => {
        const level = (item.style.paddingLeft.match(/\d+/) || [0])[0] / 12;
        renderFileTree(child, childrenContainer, level + 1);
      });
    }
  }
}

function renderGitChanges(changes) {
  const container = document.getElementById('changes-list');
  container.innerHTML = '';
  
  if (changes.length === 0) {
    container.innerHTML = '<div class="loading">No changes</div>';
    return;
  }
  
  changes.forEach(change => {
    const item = document.createElement('div');
    item.className = 'change-item';
    
    const status = document.createElement('span');
    status.className = `change-status ${change.status}`;
    status.textContent = getStatusIcon(change.status);
    
    const filepath = document.createElement('span');
    filepath.className = 'change-filepath';
    filepath.textContent = change.filepath;
    
    item.appendChild(status);
    item.appendChild(filepath);
    container.appendChild(item);
    
    item.addEventListener('click', () => {
      openFile(change.filepath, 'diff');
    });
  });
}

function getStatusIcon(status) {
  const icons = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    untracked: 'U'
  };
  return icons[status] || '?';
}

function renderEditorTabs() {
  const container = document.getElementById('editor-tabs');
  container.innerHTML = '';
  
  state.openTabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = 'editor-tab';
    if (tab.id === state.activeTab) {
      tabEl.classList.add('active');
    }
    
    const label = document.createElement('span');
    label.className = 'editor-tab-label';
    label.textContent = tab.name;
    
    const close = document.createElement('span');
    close.className = 'editor-tab-close';
    close.textContent = '×';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    
    tabEl.appendChild(label);
    tabEl.appendChild(close);
    container.appendChild(tabEl);
    
    tabEl.addEventListener('click', () => {
      switchTab(tab.id);
    });
  });
}

function renderFileContent(content, filepath) {
  const editorArea = document.getElementById('editor-area');
  editorArea.innerHTML = '';
  
  const contentDiv = document.createElement('pre');
  contentDiv.className = 'file-content';
  contentDiv.textContent = content;
  
  editorArea.appendChild(contentDiv);
}

function renderDiff(diffText, filepath) {
  const editorArea = document.getElementById('editor-area');
  editorArea.innerHTML = '';
  
  const diffView = document.createElement('div');
  diffView.className = 'diff-view';
  
  if (!diffText || diffText.trim() === '') {
    diffView.innerHTML = '<div class="loading">No changes in this file</div>';
    editorArea.appendChild(diffView);
    return;
  }
  
  const lines = diffText.split('\n');
  lines.forEach(line => {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'diff-line';
    
    if (line.startsWith('+') && !line.startsWith('+++')) {
      lineDiv.classList.add('added');
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      lineDiv.classList.add('deleted');
    } else if (line.startsWith('@@')) {
      lineDiv.classList.add('header');
    } else {
      lineDiv.classList.add('context');
    }
    
    lineDiv.textContent = line;
    diffView.appendChild(lineDiv);
  });
  
  editorArea.appendChild(diffView);
}

// Tab management
async function openFile(filepath, type = 'file') {
  const tabId = `${type}-${filepath}`;
  const existingTab = state.openTabs.find(t => t.id === tabId);
  
  if (existingTab) {
    switchTab(tabId);
    return;
  }
  
  const tab = {
    id: tabId,
    name: filepath.split('/').pop() || filepath,
    filepath,
    type
  };
  
  state.openTabs.push(tab);
  state.activeTab = tabId;
  
  renderEditorTabs();
  
  // Load content based on type
  const editorArea = document.getElementById('editor-area');
  editorArea.innerHTML = '<div class="loading">Loading...</div>';
  
  try {
    if (type === 'diff') {
      const { diff, error } = await fetchFileDiff(filepath);
      if (error) {
        editorArea.innerHTML = `<div class="error-message">Error: ${error}</div>`;
      } else {
        tab.content = diff;
        renderDiff(diff, filepath);
      }
    } else {
      const { content, error } = await fetchFileContent(filepath);
      if (error) {
        editorArea.innerHTML = `<div class="error-message">Error: ${error}</div>`;
      } else {
        tab.content = content;
        renderFileContent(content, filepath);
      }
    }
  } catch (error) {
    editorArea.innerHTML = `<div class="error-message">Error loading file: ${error.message}</div>`;
  }
}

function switchTab(tabId) {
  state.activeTab = tabId;
  const tab = state.openTabs.find(t => t.id === tabId);
  
  renderEditorTabs();
  
  if (tab && tab.content !== undefined) {
    if (tab.type === 'diff') {
      renderDiff(tab.content, tab.filepath);
    } else {
      renderFileContent(tab.content, tab.filepath);
    }
  }
}

function closeTab(tabId) {
  const index = state.openTabs.findIndex(t => t.id === tabId);
  if (index === -1) return;
  
  state.openTabs.splice(index, 1);
  
  if (state.activeTab === tabId) {
    if (state.openTabs.length > 0) {
      const newActiveIndex = Math.min(index, state.openTabs.length - 1);
      state.activeTab = state.openTabs[newActiveIndex].id;
    } else {
      state.activeTab = null;
      const editorArea = document.getElementById('editor-area');
      editorArea.innerHTML = `
        <div class="welcome-screen">
          <h1>Remote Code Explorer</h1>
          <p>Select a file from the explorer or a change from source control to view its contents.</p>
        </div>
      `;
    }
  }
  
  renderEditorTabs();
  
  if (state.activeTab) {
    switchTab(state.activeTab);
  }
}

// Initialize the application
async function init() {
  try {
    // Load file tree
    const fileTree = await fetchFileTree();
    state.fileTree = fileTree;
    const fileTreeContainer = document.getElementById('file-tree');
    fileTreeContainer.innerHTML = '';
    if (fileTree) {
      renderFileTree(fileTree, fileTreeContainer);
    } else {
      fileTreeContainer.innerHTML = '<div class="error-message">Failed to load file tree</div>';
    }
    
    // Load git changes
    await loadGitChanges();
    
    // Set up refresh button
    document.getElementById('refresh-git').addEventListener('click', loadGitChanges);
  } catch (error) {
    console.error('Initialization error:', error);
    document.getElementById('file-tree').innerHTML = 
      `<div class="error-message">Error: ${error.message}</div>`;
  }
}

async function loadGitChanges() {
  try {
    const { files, error } = await fetchGitStatus();
    if (error) {
      console.warn('Git status error:', error);
      state.gitChanges = [];
    } else {
      state.gitChanges = files;
    }
    renderGitChanges(state.gitChanges);
  } catch (error) {
    console.error('Error loading git changes:', error);
    renderGitChanges([]);
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
