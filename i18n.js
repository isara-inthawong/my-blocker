async function loadTranslations(lang) {
  try {
    const response = await fetch(
      chrome.runtime.getURL(`_locales/${lang}/messages.json`)
    );
    return await response.json();
  } catch (e) {
    const response = await fetch(
      chrome.runtime.getURL(`_locales/en/messages.json`)
    );
    return await response.json();
  }
}

async function localizePage() {
  chrome.storage.local.get(["preferred_lang"], async (data) => {
    let lang = data.preferred_lang;
    if (!lang) {
      lang = chrome.i18n.getUILanguage().startsWith("th") ? "th" : "en";
    }

    const messages = await loadTranslations(lang);

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (messages[key]) {
        const text = messages[key].message;
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          if (el.hasAttribute("placeholder")) {
            el.placeholder = text;
          }
        } else {
          el.textContent = text;
        }
      }
    });

    const langSelect = document.getElementById("langSelect");
    if (langSelect) {
      langSelect.value = lang;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  localizePage();
});

// i18n.js
async function getMsg(key, fallback) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["preferred_lang"], async (data) => {
      let lang =
        data.preferred_lang ||
        (chrome.i18n.getUILanguage().startsWith("th") ? "th" : "en");
      try {
        const response = await fetch(
          chrome.runtime.getURL(`_locales/${lang}/messages.json`)
        );
        const messages = await response.json();
        if (messages[key] && messages[key].message) {
          resolve(messages[key].message);
          return;
        }
      } catch (e) {}
      resolve(fallback);
    });
  });
}
