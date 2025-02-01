const DEBUG = false;

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({
    text: "",
  });
  setNumTimesUsed(0);
});

async function refreshCss() {
  const className = `reload_css_auto_remove_${(new Date()).getTime()}`;
  const debug = false ? console.log : () => {};

  const refreshCssElements = async () => {
    const cssElements = getCssElements();
    const promises = [];

    const pfx = '🔃 Easy CSS Reloader | ';

    debug(`${pfx}Refreshing ${cssElements.length} stylesheet link elements`)
    cssElements.forEach((el) => {
      promises.push(updateElement(el));
    });

    debug(`${pfx}  > awaiting all to be re loaded`)
    await Promise.all(promises);

    debug(`${pfx}  > all ${cssElements.length} elements refreshed, removing remaining old elements`)
    removeOldElements();

    debug(`${pfx}  > done!`)
    return cssElements.length;
  };

  const getCssElements = () => {
    return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter(isStylesheetElement);
  };

  const isStylesheetElement = (el) => {
    return el.nodeName.toUpperCase() === 'LINK' && (
      !el.type ||
      el.type.trim() === '' ||
      el.type.toLowerCase().includes('css')
    );
  };

  const updateElement = async (el, maxWait = 2000) => {
    const newEl = el.cloneNode();
    el.classList.add(className);

    newEl.href = modifyUrl(el.href, {'reload_css': (new Date()).getTime()});

    el.insertAdjacentElement('afterend', newEl)

    return new Promise((resolve) => {
      let resolved = false;
      const handleFinished = () => {
        if (!resolved) {
          removeEl(el);
          resolved = true;
          resolve();
        }
      }
      newEl.addEventListener('load', handleFinished);
      newEl.addEventListener('error', handleFinished);
      setTimeout(handleFinished, maxWait);
    });
  };

  const removeEl = (el) => {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  };

  const modifyUrl = (url, params = {}) => {
    const urlOb = new URL(url);
    const urlParams = new URLSearchParams(urlOb.search);
    for (const [name, value] of Object.entries(params)) {
      urlParams.set(name, value);
    }
    urlOb.search = urlParams.toString();
    return urlOb.toString();
  };

  const removeOldElements = () => {
    Array.from(document.querySelectorAll(`.${className}`)).forEach(el => {
      removeEl(el);
    });
  };

  return await refreshCssElements();
}

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

async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

async function refreshTab(tab) {
  await chrome.action.setBadgeText({
    tabId: tab.id,
    text: '🔃',
  });

  const start = performance.now();
  const [{result}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: refreshCss
  });
  await chrome.action.setBadgeText({
    tabId: tab.id,
    text: result ? `${result}🔃` : '🔃',
  });

  const minTime = 750;
  const elapsed = start - performance.now();
  if (elapsed < minTime) {
    await new Promise((resolve) => {
      setTimeout(async () => {
        // Set the action badge to the next state
        await chrome.action.setBadgeText({
          tabId: tab.id,
          text: '',
        });
        resolve();
      }, minTime - elapsed);
    });
  } else {
    // Set the action badge to the next state
    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: '',
    });
  }
  return result;
}

const timeouts = {};
async function toggleAutoRefresh(tab, autoRefreshTimeout) {
  if (timeouts[tab.id]) {
    toggleAutoRefreshOff(tab);
  } else {
    toggleAutoRefreshOn(tab, autoRefreshTimeout);
  }
}

async function toggleAutoRefreshOff(tab) {
  console.log(`Stopping auto refresh`);

  clearInterval(timeouts[tab.id]);
  timeouts[tab.id] = null;
  delete timeouts[tab.id];
  await chrome.action.setBadgeText({
    tabId: tab.id,
    text: '',
  });
}

async function toggleAutoRefreshOn(tab, autoRefreshTimeout) {
  console.log(`Auto refreshing every ${autoRefreshTimeout}`);

  await refreshTab(tab);

  let time = 5000;
  try {
    time = parseTimeString(autoRefreshTimeout);
  } catch (e) {
    console.error(e.message);
    time = 5000;
  }

  timeouts[tab.id] = setInterval(async () => {
    if (
      tab.status === "complete" &&
      (
        tab.pinned ||
        (
          tab.active &&
          !tab.discarded &&
          !tab.frozen
        )
      )
    ) {
      await refreshTab(tab);
    }
  }, time);
}

async function getNumTimesUsed() {
  return chrome.storage.sync.get({ numTimesUsed: 0 }).then(({ numTimesUsed }) => numTimesUsed);
}

async function setNumTimesUsed(numTimesUsed) {
  return chrome.storage.sync.set({ numTimesUsed });
}

async function incrementNumTimesUsed() {
  const numTimesUsed = await getNumTimesUsed();
  await setNumTimesUsed(numTimesUsed + 1);
  return numTimesUsed + 1;
}

async function registerUsage() {
  const numTimesUsed = await incrementNumTimesUsed();
  console.log(`Used ${numTimesUsed} times`);
  if (numTimesUsed === 5 || DEBUG) {
    chrome.tabs.create({url: 'page/rate.html'});
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-autorefresh') {
    console.log('Toggling auto refresh');
    const tab = await getCurrentTab();
    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: '🔃',
    });
    chrome.storage.sync.get(
      { autoRefreshTimeout: '5s' },
      async ({ autoRefreshTimeout }) => {
        await toggleAutoRefresh(tab, autoRefreshTimeout);
      }
    );
    registerUsage();
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  const result = await refreshTab(tab);
  registerUsage();
});