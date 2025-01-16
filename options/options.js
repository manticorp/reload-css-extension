function parseTimeString(timeString) {
  const multipliers = {
    s: 1000,
    second: 1000,
    seconds: 1000,
    ms: 1,
    millisecond: 1,
    milliseconds: 1,
    m: 1000 * 60,
    minute: 1000 * 60,
    minutes: 1000 * 60,
    h: 1000 * 60 * 60,
    hour: 1000 * 60 * 60,
    hours: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24,
    day: 1000 * 60 * 60 * 24,
    days: 1000 * 60 * 60 * 24,
  };
  const matchRegex = /([0-9]+[0-9.]*) *(ms|milliseconds?|s|seconds?|m|minutes?|h|hours?|d|days?)?/;
  const matches = `${timeString}`.match(matchRegex);
  if (matches) {
    let [proxy, num, unit] = matches;
    if (num) {
      num = parseFloat(num);
      if (unit && typeof multipliers[unit] !== 'undefined') {
        num *= multipliers[unit];
      }
      if (num <= 0) {
        throw new Error('Timeout must be positive.');
      }
      return num;
    }
  }
  throw new Error(`Invalid time string ${timeString} - please check CSS Easy Reload settings.`);
}

const saveOptions = () => {
  const autoRefreshTimeout = document.getElementById('auto_refresh_timout').value;
  let refreshMilliseconds;
  const status = document.getElementById('status');
  let shouldSave = false;

  try {
    refreshMilliseconds = parseTimeString(autoRefreshTimeout);
    shouldSave = true;
  } catch (e) {
    status.textContent = `Invalid time string "${autoRefreshTimeout}"`;
  }

  if (shouldSave) {
    chrome.storage.sync.set(
      { autoRefreshTimeout },
      () => {
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
    { autoRefreshTimeout: '5s' },
    ({autoRefreshTimeout}) => {
      document.getElementById('auto_refresh_timout').value = autoRefreshTimeout;
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);