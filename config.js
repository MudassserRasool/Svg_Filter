const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');

// Load initial state
let state;
try {
  const data = fs.readFileSync(configPath, 'utf8');
  state = JSON.parse(data);
  // Ensure all required properties exist
  if (typeof state.downloadCount !== 'number') state.downloadCount = 0;
  if (typeof state.failedCount !== 'number') state.failedCount = 0;
} catch (error) {
  // If file doesn't exist or is corrupted, create default
  state = { downloadCount: 0, failedCount: 0 };
  saveState();
}

function saveState() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Failed to save state:', error.message);
  }
}

// Override property setter to auto-save
const handler = {
  set(target, property, value) {
    target[property] = value;
    saveState();
    return true;
  },
};

const proxiedState = new Proxy(state, handler);

module.exports = proxiedState;
