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
  // ป้องกัน Context หลุดเวลาอัปเดต Extension
  if (!chrome.runtime?.id) return;

  try {
    chrome.storage.local.get([hostname], (result) => {
      if (chrome.runtime.lastError) return;
      const hiddenList = result[hostname] || [];

      const activeSelectors = new Set();
      hiddenList.forEach((item) => {
        const selector =
          item && typeof item === "object" ? item.selector : item;
        if (selector && typeof selector === "string") {
          activeSelectors.add(selector);
        }
      });

      const previouslyHiddenElements = document.querySelectorAll(
        '[data-element-blocker-hidden="true"]'
      );

      previouslyHiddenElements.forEach((el) => {
        const originalSelector = el.getAttribute(
          "data-element-blocker-selector"
        );
        if (!activeSelectors.has(originalSelector)) {
          el.style.removeProperty("display");
          el.removeAttribute("data-element-blocker-hidden");
          el.removeAttribute("data-element-blocker-selector");

          if (el.getAttribute("style") === "") {
            el.removeAttribute("style");
          }
        }
      });

      activeSelectors.forEach((selector) => {
        try {
          document.querySelectorAll(selector).forEach((el) => {
            el.style.setProperty("display", "none", "important");
            el.setAttribute("data-element-blocker-hidden", "true");
            el.setAttribute("data-element-blocker-selector", selector);
          });
        } catch (e) {
          // ป้องกัน Error พังทั้งระบบกรณีผู้ใช้กรอก Selector ผิดฟอร์ม
        }
      });
    });
  } catch (e) {
    // ป้องกันกรณีบริบทถูกทำลายไปแล้วระหว่างกำลังทำงาน
  }
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

function createBanner() {
  let banner = document.getElementById("element-blocker-banner");
  if (banner) {
    banner.remove();
  }

  if (!chrome.runtime?.id) return;

  try {
    chrome.storage.local.get(["preferred_lang"], (data) => {
      if (chrome.runtime.lastError) return;
      const lang =
        data.preferred_lang ||
        (navigator.language.startsWith("th") ? "th" : "en");

      const bannerText =
        lang === "th"
          ? "🔴 โหมดเลือก Element (คลิกซ้ายเพื่อซ่อน, กด ESC เพื่อออก)"
          : "🔴 Picker mode active (Left click to hide continuously, Press ESC to exit)";

      const exitText = lang === "th" ? "ออก" : "Exit";

      banner = document.createElement("div");
      banner.id = "element-blocker-banner";
      banner.style.cssText = `
        position: fixed; top: 10px; right: 10px; z-index: 999999;
        background: #d93025; color: white; padding: 10px 15px;
        font-family: sans-serif; font-size: 14px; border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex;
        align-items: center; gap: 10px;
      `;

      banner.innerHTML = `
        <span>${bannerText}</span>
        <button id="exit-picker-btn" style="background: white; color: #d93025; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-weight: bold;">${exitText}</button>
      `;
      document.body.appendChild(banner);

      document
        .getElementById("exit-picker-btn")
        .addEventListener("click", stopPicking);
    });
  } catch (e) {}
}

document.addEventListener(
  "mouseover",
  (e) => {
    if (!isPicking) return;
    if (e.target.closest("#element-blocker-banner")) return;

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
    if (e.target.closest("#element-blocker-banner")) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    const selector = getCssSelector(target);

    if (selector && chrome.runtime?.id) {
      try {
        chrome.storage.local.get([hostname], (result) => {
          if (chrome.runtime.lastError) return;
          let hiddenList = result[hostname] || [];

          const existingIndex = hiddenList.findIndex(
            (item) => item.selector === selector
          );

          if (existingIndex !== -1) {
            hiddenList[existingIndex].timestamp = Date.now();
          } else {
            hiddenList.push({ selector: selector, timestamp: Date.now() });
          }

          chrome.storage.local.set({ [hostname]: hiddenList }, () => {
            if (!chrome.runtime.lastError) {
              applySavedHiddenElements();
            }
          });
        });
      } catch (e) {}
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
    banner.remove();
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!chrome.runtime?.id) return;

  if (request.action === "start_picker") {
    isPicking = true;
    createBanner();
    sendResponse({ status: "started" });
  } else if (request.action === "stop_picker") {
    stopPicking();
    sendResponse({ status: "stopped" });
  } else if (request.action === "refreshHiddenElements") {
    applySavedHiddenElements();
    sendResponse({ status: "refreshed" });
  } else if (request.action === "previewSelector") {
    try {
      const elements = document.querySelectorAll(request.selector);
      const results = Array.from(elements)
        .slice(0, 5)
        .map((el) => {
          return el.outerHTML.length > 100
            ? el.outerHTML.substring(0, 100) + "..."
            : el.outerHTML;
        });
      sendResponse({ elements: results });
    } catch (e) {
      sendResponse({ elements: [] });
    }
    return true;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!chrome.runtime?.id) return;
  if (areaName === "local" && changes.preferred_lang && isPicking) {
    createBanner();
  }
});
