document.addEventListener("DOMContentLoaded", () => {
  // แปลข้อความทั่วไป (textContent)
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const translated = chrome.i18n.getMessage(key);
    if (translated) el.textContent = translated;
  });

  // แปล Tooltip (title)
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    const translated = chrome.i18n.getMessage(key);
    if (translated) el.title = translated;
  });

  // แปล Placeholder ในช่อง Input
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const translated = chrome.i18n.getMessage(key);
    if (translated) el.placeholder = translated;
  });
});
