chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({
    text: "",
  });
});

async function refreshCss() {
  const className = `reload_css_auto_remove_${(new Date()).getTime()}`;
  const debug = true ? console.log : () => {};

  const refreshCssElements = async () => {
    const cssElements = getCssElements();
    const promises = [];

    debug(`Refreshing ${cssElements.length} stylesheet link elements`)
    cssElements.forEach((el) => {
      promises.push(updateElement(el));
    });

    debug(`  | awaiting all to be re loaded`)
    await Promise.all(promises);

    debug(`  | all ${cssElements.length} elements refreshed, removing remaining old elements`)
    removeOldElements();

    debug(`  | done!`)
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

chrome.action.onClicked.addListener(async (tab) => {
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
    text: result ? `${result}` : '🔃',
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
});