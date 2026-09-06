function getCssSelector(el) {
  if (!(el instanceof Element)) return "";
  if (el.id) return `#${CSS.escape(el.id)}`;
  let path = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.className && typeof el.className === "string") {
      let classes = el.className
        .trim()
        .split(/\s+/)
        .filter((c) => c);
      if (classes.length > 0) {
        selector += `.${classes.map((c) => CSS.escape(c)).join(".")}`;
      }
    }
    let sib = el,
      nth = 1;
    while ((sib = sib.previousElementSibling)) {
      if (sib.nodeName.toLowerCase() === selector.split(".")[0]) nth++;
    }
    selector += `:nth-of-type(${nth})`;
    path.unshift(selector);
    el = el.parentNode;
    if (el && el.nodeName === "BODY") {
      path.unshift("body");
      break;
    }
  }
  return path.join(" > ");
}

const hostname = window.location.hostname;

function applySavedHiddenElements() {
  chrome.storage.local.get([hostname], (result) => {
    const hiddenList = result[hostname] || [];
    hiddenList.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          el.style.setProperty("display", "none", "important");
        });
      } catch (e) {
        // ข้าม selector ที่พิมพ์ผิดรูปแบบเพื่อไม่ให้เว็บพัง
      }
    });
  });
}

applySavedHiddenElements();

const observer = new MutationObserver(() => {
  applySavedHiddenElements();
});
observer.observe(document.documentElement, { childList: true, subtree: true });

let isPicking = false;
let highlightBox = null;

function createHighlightBox() {
  if (highlightBox) return;
  highlightBox = document.createElement("div");
  highlightBox.style.position = "fixed";
  highlightBox.style.zIndex = "999999";
  highlightBox.style.border = "2px dashed red";
  highlightBox.style.backgroundColor = "rgba(255, 0, 0, 0.1)";
  highlightBox.style.pointerEvents = "none";
  document.body.appendChild(highlightBox);
}
// content.js จะไม่สามารถเรียกใช้ getMsg จากไฟล์ i18n.js ได้โดยตรง เนื่องจาก Chrome ไม่อนุญาตให้ Content Script แชร์ฟังก์ชันข้ามไฟล์จาวาสคริปต์
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

async function createBanner() {
  let banner = document.getElementById("element-blocker-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "element-blocker-banner";
    banner.style.cssText = `
      position: fixed; top: 10px; right: 10px; z-index: 999999;
      background: #d93025; color: white; padding: 10px 15px;
      font-family: sans-serif; font-size: 14px; border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: none;
      align-items: center; gap: 10px;
    `;

    const bannerText = await getMsg(
      "pickerBannerText",
      "🔴 Picker mode active (Left click to hide continuously, Press ESC to exit)"
    );
    const exitText = await getMsg("exitBtnText", "Exit");

    banner.innerHTML = `
      <span>${bannerText}</span>
      <button id="exit-picker-btn" style="background: white; color: #d93025; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-weight: bold;">${exitText}</button>
    `;
    document.body.appendChild(banner);

    document
      .getElementById("exit-picker-btn")
      .addEventListener("click", stopPicking);
  }
  return banner;
}

document.addEventListener(
  "mouseover",
  (e) => {
    if (!isPicking) return;
    e.stopPropagation();
    const rect = e.target.getBoundingClientRect();
    createHighlightBox();
    highlightBox.style.top = `${rect.top}px`;
    highlightBox.style.left = `${rect.left}px`;
    highlightBox.style.width = `${rect.width}px`;
    highlightBox.style.height = `${rect.height}px`;
  },
  true
);

document.addEventListener(
  "click",
  (e) => {
    if (!isPicking) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    const selector = getCssSelector(target);

    if (selector) {
      chrome.storage.local.get([hostname], (result) => {
        let hiddenList = result[hostname] || [];
        if (!hiddenList.includes(selector)) {
          hiddenList.push(selector);
          chrome.storage.local.set({ [hostname]: hiddenList }, () => {
            applySavedHiddenElements();
          });
        }
      });
    }
  },
  true
);

function stopPicking() {
  isPicking = false;
  if (highlightBox) {
    highlightBox.remove();
    highlightBox = null;
  }
  const banner = document.getElementById("element-blocker-banner");
  if (banner) {
    banner.style.display = "none";
  }
}

document.addEventListener(
  "keydown",
  (e) => {
    if (isPicking && e.key === "Escape") {
      stopPicking();
    }
  },
  true
);

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "start_picker") {
    isPicking = true;
    const banner = await createBanner();
    banner.style.display = "flex";
    sendResponse({ status: "started" });
  } else if (request.action === "stop_picker") {
    stopPicking();
    sendResponse({ status: "stopped" });
  }
});
