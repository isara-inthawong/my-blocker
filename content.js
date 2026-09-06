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
        // รองรับกรณี Custom selector เช่น img[src$=".gif"] หรือ selector ทั่วไป
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
    stopPicking();
  },
  true
);

function stopPicking() {
  isPicking = false;
  if (highlightBox) {
    highlightBox.remove();
    highlightBox = null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_picker") {
    isPicking = true;
    sendResponse({ status: "started" });
  }
});
