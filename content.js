// รายการ CSS Selector ของโฆษณาหรือแท็กที่ต้องการซ่อน
const selectorsToHide = [
  ".ads-banner", // ตัวอย่างคลาสโฆษณา สมมติ
  "#sidebar-ads", // ตัวอย่างไอดีโฆษณา
  'iframe[src*="ads"]', // iframe ที่มีคำว่า ads
  'div[class*="advert"]' // div ที่ชื่อคลาสมีคำว่า advert
];

function removeAds() {
  selectorsToHide.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.style.setProperty("display", "none", "important");
      // หรือใช้ element.remove(); หากต้องการลบทิ้งจาก DOM เลย
    });
  });
}

// รันทันทีที่โหลดสคริปต์
removeAds();

// ใช้ MutationObserver เพื่อดักจับโฆษณาที่โหลดขึ้นมาทีหลัง (Dynamic Ads)
const observer = new MutationObserver(() => {
  removeAds();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});
