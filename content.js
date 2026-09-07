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

const hostname = window.location.hostname.toLowerCase();

// ฟังก์ชันสำหรับตรวจจับและซ่อนโฆษณาอัตโนมัติ จะบันทึกลง Storage เมื่อเจอและซ่อน Element จริง ๆ เท่านั้น
function autoDetectAndHideAds() {
  try {
    chrome.storage.local.get(
      [hostname, "disabled_auto_selectors"],
      (result) => {
        if (chrome.runtime.lastError) return;

        const hiddenList = result[hostname] || [];
        const disabledSelectors = result.disabled_auto_selectors || [];

        const adKeywords =
          typeof DEFAULT_AD_KEYWORDS !== "undefined"
            ? DEFAULT_AD_KEYWORDS
            : [
                "สนับสนุนโดย",
                "sponsored",
                "advertisement",
                "ad-banner",
                "adsbygoogle"
              ];

        let storageUpdated = false;

        document.querySelectorAll("div, section, aside").forEach((el) => {
          const text = el.innerText ? el.innerText.trim().toLowerCase() : "";
          const hasAdKeyword =
            text.length < 50 &&
            adKeywords.some((keyword) => text.includes(keyword));

          if (hasAdKeyword && el.childElementCount < 10) {
            const selector = getCssSelector(el);
            if (!selector) return;

            // ถ้า Selector นี้เคยถูกผู้ใช้กดลบออกจาก Auto ให้ข้ามการซ่อน
            if (disabledSelectors.includes(selector)) return;

            // ตรวจสอบให้มั่นใจว่าพบ Element นี้อยู่จริงบนหน้าเว็บก่อนดำเนินการซ่อนและบันทึก
            const matchedElements =
              el.querySelectorAll(selector) ||
              document.querySelectorAll(selector);
            if (matchedElements.length === 0 && !el.matches(selector)) return;

            el.style.setProperty("display", "none", "important");
            el.setAttribute("data-element-blocker-hidden", "true");
            el.setAttribute("data-element-blocker-selector", selector);

            // ตรวจสอบว่ามีอยู่ใน hiddenList หรือยัง (ถ้ายัง ให้เพิ่มเพื่อให้ไปโชว์ในหน้า UI เฉพาะตอนที่เจอจริง ๆ)
            const exists = hiddenList.some(
              (item) =>
                (typeof item === "object" ? item.selector : item) === selector
            );

            if (!exists) {
              hiddenList.push({
                selector: selector,
                timestamp: Date.now(),
                isAuto: true // ระบุว่าเป็นรายการที่ระบบทำให้อัตโนมัติ
              });
              storageUpdated = true;
            }
          }
        });

        if (storageUpdated) {
          chrome.storage.local.set({ [hostname]: hiddenList });
        }
      }
    );
  } catch (e) {}
}

function applySavedHiddenElements() {
  if (!chrome.runtime?.id) return;

  try {
    chrome.storage.local.get(["disabled_auto_hosts", hostname], (result) => {
      if (chrome.runtime.lastError) return;

      const disabledHosts = result.disabled_auto_hosts || [];
      const isAutoDisabled = disabledHosts.includes(hostname);
      const hiddenList = result[hostname] || [];

      const activeSelectors = new Set();
      let storageUpdated = false;

      // 1. นำ Selector ที่เคยบันทึกไว้แล้วใน Storage มาใส่ชุด activeSelectors ก่อน
      hiddenList.forEach((item) => {
        const selector =
          item && typeof item === "object" ? item.selector : item;
        if (selector && typeof selector === "string") {
          activeSelectors.add(selector);
        }
      });

      // 2. ตรวจสอบกฎจาก DEFAULT_AUTO_PICK_RULES (ซ่อนจริง แต่จะบันทึกเมื่อเจอตัวตนบนเว็บเท่านั้น)
      if (!isAutoDisabled && typeof DEFAULT_AUTO_PICK_RULES !== "undefined") {
        DEFAULT_AUTO_PICK_RULES.forEach((rule) => {
          if (rule && typeof rule === "string") {
            try {
              // เช็คว่ามี Element นี้อยู่จริงบนหน้าเว็บหรือไม่
              const matchedElements = document.querySelectorAll(rule);
              if (matchedElements.length > 0) {
                activeSelectors.add(rule);

                // เช็คว่าเคยบันทึกลง hiddenList หรือยัง ถ้ายังให้เพิ่มและบันทึกเฉพาะตอนเจอจริง
                const exists = hiddenList.some(
                  (item) =>
                    (typeof item === "object" ? item.selector : item) === rule
                );

                if (!exists) {
                  hiddenList.push({
                    selector: rule,
                    timestamp: Date.now(),
                    isAuto: true
                  });
                  storageUpdated = true;
                }
              }
            } catch (e) {}
          }
        });
      }

      const previouslyHiddenElements = document.querySelectorAll(
        '[data-element-blocker-hidden="true"]'
      );

      previouslyHiddenElements.forEach((el) => {
        const originalSelector = el.getAttribute(
          "data-element-blocker-selector"
        );
        if (
          !activeSelectors.has(originalSelector) &&
          originalSelector !== "auto-detected-ad"
        ) {
          el.style.removeProperty("display");
          el.removeAttribute("data-element-blocker-hidden");
          el.removeAttribute("data-element-blocker-selector");

          if (el.getAttribute("style") === "") {
            el.removeAttribute("style");
          }
        }
      });

      // ซ่อนตาม Selector ทั้งหมดที่ใช้งานอยู่
      activeSelectors.forEach((selector) => {
        try {
          document.querySelectorAll(selector).forEach((el) => {
            el.style.setProperty("display", "none", "important");
            el.setAttribute("data-element-blocker-hidden", "true");
            el.setAttribute("data-element-blocker-selector", selector);
          });
        } catch (e) {}
      });

      // บันทึกเฉพาะตอนที่มีการพบกฎใหม่บนหน้าเว็บจริง ๆ เท่านั้น
      if (storageUpdated) {
        chrome.storage.local.set({ [hostname]: hiddenList });
      }

      if (!isAutoDisabled) {
        autoDetectAndHideAds();
      }
    });
  } catch (e) {}
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
        chrome.storage.local.get(
          [hostname, "disabled_auto_selectors"],
          (result) => {
            if (chrome.runtime.lastError) return;
            let hiddenList = result[hostname] || [];
            let disabledSelectors = result.disabled_auto_selectors || [];

            // ถ้าผู้ใช้กดเลือกเอง ให้ปลดออกจากรายชื่อข้ามการ Auto (ถ้ามี)
            disabledSelectors = disabledSelectors.filter((s) => s !== selector);

            const existingIndex = hiddenList.findIndex(
              (item) =>
                (typeof item === "object" ? item.selector : item) === selector
            );

            if (existingIndex !== -1) {
              hiddenList[existingIndex].timestamp = Date.now();
              delete hiddenList[existingIndex].isAuto; // เปลี่ยนสถานะเป็นเลือกเอง (User-picked)
            } else {
              hiddenList.push({ selector: selector, timestamp: Date.now() });
            }

            chrome.storage.local.set(
              {
                [hostname]: hiddenList,
                disabled_auto_selectors: disabledSelectors
              },
              () => {
                if (!chrome.runtime.lastError) {
                  applySavedHiddenElements();
                }
              }
            );
          }
        );
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
  } else if (
    request.action === "previewSelector" ||
    request.action === "previewSelectorWithAttributes"
  ) {
    try {
      const elements = document.querySelectorAll(request.selector);
      const results = Array.from(elements)
        .slice(0, 5)
        .map((el) => {
          return el.outerHTML.length > 100
            ? el.outerHTML.substring(0, 100) + "..."
            : el.outerHTML;
        });

      const attributes = Array.from(elements)
        .slice(0, 5)
        .map((el) => ({
          id: el.id || "",
          className: el.className || "",
          alt: el.getAttribute("alt") || "",
          name: el.getAttribute("name") || "",
          src: el.getAttribute("src") || ""
        }));

      sendResponse({ elements: results, attributes: attributes });
    } catch (e) {
      sendResponse({ elements: [], attributes: [] });
    }
    return true;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!chrome.runtime?.id) return;
  if (areaName === "local") {
    if (changes.preferred_lang && isPicking) {
      createBanner();
    }
    if (
      changes.disabled_auto_hosts ||
      changes[hostname] ||
      changes.disabled_auto_selectors
    ) {
      applySavedHiddenElements();
    }
  }
});
