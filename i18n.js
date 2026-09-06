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
  try {
    const data = await chrome.storage.local.get(["preferred_lang"]);
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

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (messages[key]) {
        el.placeholder = messages[key].message;
      }
    });

    const langSelect = document.getElementById("langSelect");
    if (langSelect) {
      langSelect.value = lang;
    }
  } catch (e) {
    console.error("Localization error:", e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  localizePage();
});

async function getMsg(key, fallback) {
  try {
    const data = await chrome.storage.local.get(["preferred_lang"]);
    let lang =
      data.preferred_lang ||
      (chrome.i18n.getUILanguage().startsWith("th") ? "th" : "en");

    const messages = await loadTranslations(lang);
    if (messages[key] && messages[key].message) {
      return messages[key].message;
    }
  } catch (e) {}
  return fallback;
}
