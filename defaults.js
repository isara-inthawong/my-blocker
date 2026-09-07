// defaults.js
const DEFAULT_AUTO_PICK_RULES = [
  "img[src$='.gif']",
  "img[src$='.webp']",
  "[class*='ads']",
  "[id*='ads']",
  "div[class*='content-ads']",
  ".ads-container",
  ".advertisement",
  // เพิ่มกลุ่ม Selector ตรวจจับโฆษณาและลิงก์เสี่ยงลงมาที่นี่
  "iframe[src*='ads']",
  "img[src*='banner']",
  "a[href*='bet']",
  "a[href*='casino']"
];

const DEFAULT_AD_KEYWORDS = [
  "สนับสนุนโดย",
  "sponsored",
  "advertisement",
  "ad-banner",
  "adsbygoogle"
];
