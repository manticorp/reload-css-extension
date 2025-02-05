import { parseTimeString } from './../scripts/utils.js';


const saveOptions = () => {
  const saveBtn = document.getElementById('save');
  const origText = saveBtn.innerText;
  saveBtn.innerText = 'Saving...';
  saveBtn.disabled = true;

  const autoRefreshTimeout = document.getElementById('auto_refresh_timout').value;
  const blacklist = document.getElementById('blacklist').value;
  let refreshMilliseconds;
  const status = document.getElementById('status');
  let shouldSave = false;

  try {
    refreshMilliseconds = parseTimeString(autoRefreshTimeout);
    shouldSave = true;
  } catch (e) {
    status.textContent = `Invalid time string "${autoRefreshTimeout}"`;
  }
  const quiet = document.getElementById('quiet').checked;

  if (shouldSave) {
    chrome.storage.sync.set(
      {
        autoRefreshTimeout,
        blacklist,
        quiet
      },
      () => {
        saveBtn.innerText = origText;
        saveBtn.disabled = false;
        // Update status to let user know options were saved.
        status.textContent = `Options saved. Refresh timeout set to ${autoRefreshTimeout} (${refreshMilliseconds}ms)`;
        setTimeout(() => {
          status.textContent = '';
        }, 1250);
      }
    );
  }
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.sync.get(
    {
      autoRefreshTimeout: '5s',
      blacklist: '',
      quiet: false
    },
    ({autoRefreshTimeout, blacklist, quiet}) => {
      document.getElementById('auto_refresh_timout').value = autoRefreshTimeout;
      document.getElementById('blacklist').value = blacklist;
      document.getElementById('quiet').checked = quiet;
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
// document.getElementById('blacklist').addEventListener('change', saveOptions);
// document.getElementById('auto_refresh_timout').addEventListener('change', saveOptions);
// document.getElementById('quiet').addEventListener('change', saveOptions);