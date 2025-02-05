import Version from './version.js';
import { parseTimeString } from './utils.js';

const DEBUG = false;
const DEFAULT_BLACKLIST = [
    'yui.yahooapis.com',
    'ajax.googleapis.com',
    'fonts.googleapis.com',
    'ajax.aspnetcdn.com',
    'ajax.microsoft.com',
    'code.jquery.com',
    'use.typekit.net',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com'
];

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.action.setBadgeText({
    text: "",
  });
  if (details.reason !== 'update') {
    await chrome.storage.sync.set({
      numTimesUsed: 0,
      blacklist: DEFAULT_BLACKLIST.join("\n")
    });
  } else if (details.reason === 'update') {
    const previousVersion = new Version(details.previousVersion);
    console.log(`Previous Version = ${previousVersion.toString()}`);
    if (previousVersion.lt('1.2.0')) {
      console.log('Adding blacklist to default options.');
      await chrome.storage.sync.set({
        numTimesUsed: 0,
        blacklist: DEFAULT_BLACKLIST.join("\n")
      });
    }
  }
});

const getBlacklist = async () => {
  return chrome.storage.sync.get({blacklist: DEFAULT_BLACKLIST.join("\n")})
  .then(({blacklist}) => {
    return blacklist
    .split("\n")
    .map(a => a.trim())
    .filter(a => a !== '');
  });
};

const getQuiet = async () => {
  return chrome.storage.sync.get({quiet: false})
  .then(({quiet}) => !!quiet);
};

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

async function consoleMessage(tab, ...msg) {
  if (! await getQuiet()) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: ({msg}) => {
        const tstr = (new Date()).toLocaleTimeString();
        const pfx = `%c🔃 Easy CSS Reloader%c | %c${tstr}%c | `;
        console.log.apply(console.log, [`${pfx}${msg.splice(0, 1)}`, 'color: #eb2d57', null, 'color: #eb2d57', null, ...msg]);
      },
      args: [{msg}]
    }).catch(e => console.error(e));
  }
}

async function refreshCss(options) {
  const className = `reload_css_auto_remove_${(new Date()).getTime()}`;
  const shouldLog = !options.quiet || !!(options.debug ?? false);
  const debug = (shouldLog) ? console.log : () => {};
  const pfxd = (...strs) => {
    const tstr = (new Date()).toLocaleTimeString();
    const pfx = `%c🔃 Easy CSS Reloader%c | %c${tstr}%c | `;
    debug.apply(debug, [`${pfx}${strs.splice(0,1)}`, 'color: #eb2d57', null, 'color: #eb2d57', null, ...strs]);
  }
  const {blacklist, quiet} = options;

  const shouldUpdateStylesheetElement = (el) => {
    const url = el.href;
    const isBlacklisted = blacklist.some(bl => url.includes(bl));
    if (isBlacklisted) {
      pfxd(`%c  > ${url} was ${isBlacklisted ? '' : 'not '}%cblacklisted`, null, "background: black; color: #eb2d57")
    }
    return !isBlacklisted;
  };

  const isStylesheetElement = (el) => {
    return el.nodeName.toUpperCase() === 'LINK' && (
      !el.type ||
      el.type.trim() === '' ||
      el.type.toLowerCase().includes('css')
    );
  };

  const getCssElements = () => {
    return Array
      .from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter(isStylesheetElement);
  };

  const filterCssElements = (els) => {
    return els.filter(shouldUpdateStylesheetElement);
  };

  const refreshCssElements = async () => {
    const allCssElements = getCssElements();
    pfxd(`Refreshing ${allCssElements.length} stylesheet link elements`)
    const cssElements = filterCssElements(allCssElements);
    const promises = [];

    cssElements.forEach((el) => {
      promises.push(updateElement(el));
    });

    pfxd(`  > awaiting all to be re loaded`)
    await Promise.all(promises);

    pfxd(`  > all ${cssElements.length} elements refreshed, removing remaining old elements`)
    removeOldElements();

    pfxd(`  > done!`)
    return cssElements.length;
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

  const blacklist = await getBlacklist();
  const quiet = await getQuiet();

  const start = performance.now();
  const [{result}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: refreshCss,
    args: [{blacklist, quiet: quiet || !!timeouts[tab.id], debug: DEBUG}]
  }).catch(e => console.error(e));
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
  await consoleMessage(tab, `Stopping auto refresh`);

  clearInterval(timeouts[tab.id]);
  timeouts[tab.id] = null;
  delete timeouts[tab.id];
  await chrome.action.setBadgeText({
    tabId: tab.id,
    text: '',
  });
}

async function autoRefresh(tab) {
  await consoleMessage(tab, `Refreshing now..`);
  await refreshTab(tab);
}

async function toggleAutoRefreshOn(tab, autoRefreshTimeout) {
  console.log(`Auto refreshing every ${autoRefreshTimeout}`);
  await consoleMessage(tab, `Auto refreshing CSS every ${autoRefreshTimeout}`);

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
      autoRefresh(tab);
    }
  }, time);

  await autoRefresh(tab);
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