document.addEventListener("DOMContentLoaded", async () => {
  // แปลภาษาอัตโนมัติสำหรับ Element ทั่วไปในหน้า Options ที่มี data-i18n
  if (typeof getMsg === "function") {
    const elements = document.querySelectorAll("[data-i18n]");
    for (const el of elements) {
      const key = el.getAttribute("data-i18n");
      const translated = await getMsg(key);
      if (translated) el.textContent = translated;
    }
  }

  const container = document.getElementById("storageContent");
  const editModal = document.getElementById("editModal");
  const modalBox = editModal.querySelector(".modal");
  const modalTitle = document.getElementById("modalTitle");
  const hostnameRow = document.getElementById("hostnameRow");
  const hostnameInput = document.getElementById("hostnameInput");
  const editInput = document.getElementById("editInput");
  const previewBox = document.getElementById("previewBox");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const addNewRuleBtn = document.getElementById("addNewRuleBtn");
  const langSelect = document.getElementById("langSelect");

  // ดึงคำแปลสำหรับ Placeholder และปุ่มใหม่ล่วงหน้าเพื่อไม่ให้เกิด Error
  const searchPlaceholder =
    typeof getMsg === "function"
      ? await getMsg("searchPlaceholder", "🔍 Search website...")
      : "🔍 Search website...";

  // สร้างช่องค้นหาและตัวควบคุม Pagination แทรกก่อนตารางแสดงข้อมูล
  const cardBody = document.querySelector(".card");
  const cardHeader = cardBody.querySelector(".card-header");

  const controlPanel = document.createElement("div");
  controlPanel.style.cssText =
    "display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px; flex-wrap: wrap;";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.id = "searchWebsiteInput";
  searchInput.placeholder = searchPlaceholder;
  searchInput.style.cssText =
    "padding: 6px 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 13px; width: 250px;";
  controlPanel.appendChild(searchInput);

  const paginationContainer = document.createElement("div");
  paginationContainer.id = "paginationContainer";
  paginationContainer.style.cssText =
    "display: flex; gap: 5px; align-items: center;";
  controlPanel.appendChild(paginationContainer);

  cardBody.insertBefore(controlPanel, cardHeader.nextSibling);

  let currentPage = 1;
  const itemsPerPage = 5; // กำหนดจำนวนเว็บไซต์ที่จะแสดงต่อ 1 หน้า
  let searchQuery = "";
  let currentEditData = null;

  // ฟังเหตุการณ์เมื่อข้อมูลใน chrome.storage มีการเปลี่ยนแปลงเพื่ออัปเดตหน้าจออัตโนมัติ
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      loadAllData();
    }
  });

  // กำหนดค่า select ภาษาปัจจุบันตามที่บันทึกไว้
  chrome.storage.local.get(["preferred_lang"], (data) => {
    let currentLang =
      data.preferred_lang ||
      (chrome.i18n.getUILanguage().startsWith("th") ? "th" : "en");
    if (langSelect) langSelect.value = currentLang;
  });

  if (langSelect) {
    langSelect.addEventListener("change", (e) => {
      const selectedLang = e.target.value;
      chrome.storage.local.set({ preferred_lang: selectedLang }, () => {
        location.reload();
      });
    });
  }

  // ดักจับข้อความในช่องค้นหา
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    currentPage = 1; // รีเซ็ตกลับไปหน้าแรกเมื่อทำการค้นหา
    loadAllData();
  });

  async function loadAllData() {
    const noHistoryMsg = await getMsg("noItemsText", "No hidden items yet");
    const addSiteBtnText = await getMsg(
      "addSiteRuleBtn",
      "+ Add Rule for this Site"
    );
    const deleteAllSiteBtnText = await getMsg(
      "deleteAllSiteBtn",
      "🗑️ Delete Website"
    );
    const thSelector = await getMsg("tableThSelector", "CSS Selector / Rule");
    const thManage = await getMsg("tableThManage", "Management");
    const editBtnText = await getMsg("editBtn", "Edit");
    const deleteBtnText = await getMsg("deleteBtn", "Delete");
    const confirmDelText = await getMsg(
      "confirmDeleteText",
      "Are you sure you want to delete this item?"
    );
    const confirmDelAllText = await getMsg(
      "confirmDeleteAllText",
      "Are you sure you want to delete all rules for this website?"
    );
    const websitePrefix = await getMsg("websitePrefix", "🌐 Website:");
    const prevBtnText = await getMsg("prevBtn", "◀ Prev");
    const nextBtnText = await getMsg("nextBtn", "Next ▶");

    chrome.storage.local.get(null, async (items) => {
      container.innerHTML = "";
      let keys = Object.keys(items).filter((k) => k !== "preferred_lang");

      // กรองรายการเว็บไซต์ตามคำค้นหา (Search)
      if (searchQuery) {
        keys = keys.filter((hostname) =>
          hostname.toLowerCase().includes(searchQuery)
        );
      }

      if (keys.length === 0) {
        container.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">${noHistoryMsg}</p>`;
        paginationContainer.innerHTML = "";
        return;
      }

      // ฟังก์ชันแปลงและคำนวณหาเวลาล่าสุดของแต่ละเว็บไซต์เพื่อเรียงลำดับแบบ Descending (ล่าสุดขึ้นก่อน)
      const getLatestTimestamp = (hostname) => {
        const selectors = items[hostname];
        if (!Array.isArray(selectors) || selectors.length === 0) return 0;
        return Math.max(
          ...selectors.map((sel) => {
            if (typeof sel === "object" && sel !== null) {
              return sel.timestamp || 0;
            }
            return 0; // กรณีข้อมูลเก่าที่เป็น string ธรรมดา ให้เป็น 0
          })
        );
      };

      keys.sort((a, b) => getLatestTimestamp(b) - getLatestTimestamp(a));

      // ระบบคำนวณหน้า Pagination
      const totalPages = Math.ceil(keys.length / itemsPerPage);
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      const startIndex = (currentPage - 1) * itemsPerPage;
      const paginatedKeys = keys.slice(startIndex, startIndex + itemsPerPage);

      paginatedKeys.forEach((hostname) => {
        let selectors = items[hostname];
        if (!Array.isArray(selectors) || selectors.length === 0) return;

        const section = document.createElement("div");
        section.style.marginBottom = "25px";

        const siteHeader = document.createElement("div");
        siteHeader.className = "site-header";
        siteHeader.style.display = "flex";
        siteHeader.style.justifyContent = "space-between";
        siteHeader.style.alignItems = "center";
        siteHeader.style.flexWrap = "wrap";
        siteHeader.style.gap = "10px";

        // ฝั่งซ้าย: ข้อความนำหน้า + ลิงก์เว็บไซต์
        const linkWrapper = document.createElement("div");
        linkWrapper.style.display = "flex";
        linkWrapper.style.alignItems = "center";
        linkWrapper.style.gap = "6px";

        const prefixSpan = document.createElement("span");
        prefixSpan.innerHTML = `<b>${websitePrefix}</b>`;
        linkWrapper.appendChild(prefixSpan);

        const link = document.createElement("a");
        link.href = `https://${hostname}`;
        link.target = "_blank";
        link.className = "site-link";
        link.textContent = `${hostname} ↗`;
        linkWrapper.appendChild(link);

        siteHeader.appendChild(linkWrapper);

        // ฝั่งขวา: ปุ่มเพิ่มกฎ + ปุ่มลบทั้งหมดของเว็บไซต์นี้
        const actionWrapper = document.createElement("div");
        actionWrapper.style.display = "flex";
        actionWrapper.style.gap = "8px";

        const addSiteBtn = document.createElement("button");
        addSiteBtn.textContent = addSiteBtnText;
        addSiteBtn.className = "btn-site-add";
        addSiteBtn.addEventListener("click", async () => {
          currentEditData = { mode: "add-to-site", hostname };
          const titleTemplate = await getMsg(
            "modalTitleAddSite",
            "Add CSS Selector to website: $1"
          );
          modalTitle.textContent = titleTemplate.replace("$1", hostname);
          hostnameRow.style.display = "block";
          hostnameInput.value = hostname;
          hostnameInput.readOnly = true;
          editInput.value = "";
          previewBox.innerHTML = await getMsg(
            "previewPlaceholder",
            "Type selector to preview..."
          );
          editModal.style.display = "flex";
          editInput.focus();
        });
        actionWrapper.appendChild(addSiteBtn);

        // ปุ่มลบทั้งหมดของเว็บไซต์
        const deleteAllSiteBtn = document.createElement("button");
        deleteAllSiteBtn.textContent = deleteAllSiteBtnText;
        deleteAllSiteBtn.className = "btn-del";
        deleteAllSiteBtn.style.backgroundColor = "#d93025";
        deleteAllSiteBtn.style.color = "#fff";
        deleteAllSiteBtn.addEventListener("click", () => {
          if (confirm(confirmDelAllText)) {
            chrome.storage.local.remove(hostname, () => {
              loadAllData();
            });
          }
        });
        actionWrapper.appendChild(deleteAllSiteBtn);

        siteHeader.appendChild(actionWrapper);
        section.appendChild(siteHeader);

        const table = document.createElement("table");
        table.innerHTML = `<tr><th>${thSelector}</th><th style="width: 140px; text-align:center;">${thManage}</th></tr>`;

        selectors.forEach((selItem, index) => {
          const sel =
            typeof selItem === "object" && selItem !== null
              ? selItem.selector
              : selItem;

          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="word-break: break-all; font-family: monospace;">${sel}</td>
            <td style="text-align:center; white-space: nowrap;"></td>
          `;

          const editBtn = document.createElement("button");
          editBtn.innerHTML = editBtnText;
          editBtn.className = "btn-edit";
          editBtn.addEventListener("click", async () => {
            currentEditData = { mode: "edit", hostname, index, selectors };
            modalTitle.textContent = await getMsg(
              "modalTitleEdit",
              "Edit CSS Selector"
            );
            hostnameRow.style.display = "block";
            hostnameInput.value = hostname;
            hostnameInput.readOnly = true;
            editInput.value = sel;
            editModal.style.display = "flex";
            updatePreview(hostname, sel);
            editInput.focus();
          });

          const delBtn = document.createElement("button");
          delBtn.innerHTML = deleteBtnText;
          delBtn.className = "btn-del";
          delBtn.addEventListener("click", () => {
            if (confirm(confirmDelText)) {
              selectors.splice(index, 1);
              if (selectors.length === 0) {
                chrome.storage.local.remove(hostname, () => loadAllData());
              } else {
                chrome.storage.local.set({ [hostname]: selectors }, () =>
                  loadAllData()
                );
              }
            }
          });

          const tdAction = tr.querySelector("td:last-child");
          tdAction.appendChild(editBtn);
          tdAction.appendChild(delBtn);
          table.appendChild(tr);
        });

        section.appendChild(table);
        container.appendChild(section);
      });

      renderPagination(totalPages, prevBtnText, nextBtnText);
    });
  }

  // ฟังก์ชันสร้างปุ่มเปลี่ยนหน้า (Pagination Controls)
  function renderPagination(totalPages, prevBtnText, nextBtnText) {
    paginationContainer.innerHTML = "";
    if (totalPages <= 1) return;

    const prevBtn = document.createElement("button");
    prevBtn.textContent = prevBtnText;
    prevBtn.className = "btn-cancel";
    prevBtn.style.padding = "4px 8px";
    prevBtn.disabled = currentPage === 1;
    prevBtn.style.opacity = currentPage === 1 ? "0.5" : "1";
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        loadAllData();
      }
    });
    paginationContainer.appendChild(prevBtn);

    const pageInfo = document.createElement("span");
    pageInfo.style.cssText =
      "font-size: 13px; font-weight: bold; color: #444; padding: 0 5px;";
    pageInfo.textContent = `${currentPage} / ${totalPages}`;
    paginationContainer.appendChild(pageInfo);

    const nextBtn = document.createElement("button");
    nextBtn.textContent = nextBtnText;
    nextBtn.className = "btn-cancel";
    nextBtn.style.padding = "4px 8px";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.style.opacity = currentPage === totalPages ? "0.5" : "1";
    nextBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        loadAllData();
      }
    });
    paginationContainer.appendChild(nextBtn);
  }

  addNewRuleBtn.addEventListener("click", async () => {
    currentEditData = { mode: "add-new-site" };
    modalTitle.textContent = await getMsg(
      "modalTitleNewSite",
      "Add New Website and CSS Selector"
    );
    hostnameRow.style.display = "block";
    hostnameInput.value = "";
    hostnameInput.readOnly = false;
    editInput.value = "";
    previewBox.innerHTML = await getMsg(
      "previewPlaceholder",
      "Type selector to preview..."
    );
    editModal.style.display = "flex";
    hostnameInput.focus();
  });

  async function updatePreview(hostname, selector) {
    if (!hostname || !selector) return;
    previewBox.innerHTML = await getMsg(
      "loadingPreviewText",
      "Searching information..."
    );
    try {
      const response = await fetch(`https://${hostname}`, { mode: "cors" });
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");

      const matches = doc.querySelectorAll(selector);
      previewBox.innerHTML = "";

      if (matches.length === 0) {
        const noTagMsg = await getMsg(
          "noTagFoundText",
          "No tags found on homepage (can still save and use normally)"
        );
        previewBox.innerHTML = `<span style="color: #666;">${noTagMsg}</span>`;
        return;
      }

      matches.forEach(async (el, idx) => {
        if (idx < 10) {
          const item = document.createElement("div");
          item.className = "preview-item";
          item.style.display = "flex";
          item.style.justifyContent = "space-between";
          item.style.alignItems = "center";

          const textSpan = document.createElement("span");
          const snippet =
            el.outerHTML.substring(0, 100) +
            (el.outerHTML.length > 100 ? "..." : "");
          textSpan.textContent = snippet;
          textSpan.style.flex = "1";
          textSpan.style.wordBreak = "break-all";
          item.appendChild(textSpan);

          const excludeBtn = document.createElement("button");
          excludeBtn.innerHTML = `🛡️ ${await getMsg("excludeBtn", "Exclude")}`;
          excludeBtn.className = "btn-del";
          excludeBtn.style.marginLeft = "8px";
          excludeBtn.style.padding = "2px 6px";
          excludeBtn.style.fontSize = "10px";

          excludeBtn.addEventListener("click", () => {
            const srcAttr = el.getAttribute("src");
            if (srcAttr) {
              let currentVal = editInput.value.trim();
              const filename = srcAttr.split("/").pop();
              const exclusion = `:not([src$="${filename}"])`;
              if (!currentVal.includes(exclusion)) {
                editInput.value = currentVal + exclusion;
                updatePreview(hostname, editInput.value.trim());
              }
            }
          });

          item.appendChild(excludeBtn);
          previewBox.appendChild(item);
        }
      });
    } catch (e) {
      const corsMsg = await getMsg(
        "corsBypassText",
        "ℹ️ Live preview skipped (due to CORS policy), but you can save and use it normally."
      );
      previewBox.innerHTML = `<span style="color: #1a73e8;">${corsMsg}</span>`;
    }
  }

  editInput.addEventListener("input", () => {
    const selector = editInput.value.trim();
    let targetHost = hostnameInput.value.trim();
    updatePreview(targetHost, selector);
  });

  hostnameInput.addEventListener("input", () => {
    if (currentEditData && currentEditData.mode === "add-new-site") {
      updatePreview(hostnameInput.value.trim(), editInput.value.trim());
    }
  });

  saveBtn.addEventListener("click", async () => {
    if (!currentEditData) return;
    const newVal = editInput.value.trim();
    if (newVal === "") {
      alert(await getMsg("alertEmptySelector", "Please enter a CSS Selector"));
      return;
    }

    if (
      currentEditData.mode === "add-new-site" ||
      currentEditData.mode === "add-to-site"
    ) {
      let host = hostnameInput.value
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");
      if (!host) {
        alert(
          await getMsg(
            "alertEmptyHostname",
            "Please enter a valid website hostname"
          )
        );
        return;
      }

      chrome.storage.local.get([host], (result) => {
        let selectors = result[host] || [];
        // แปลงข้อมูลเก่าที่เป็น string ให้เป็น object เพื่อรองรับระบบ timestamp
        selectors = selectors.map((s) =>
          typeof s === "string" ? { selector: s, timestamp: Date.now() } : s
        );

        // เพิ่มรายการใหม่พร้อมบันทึกเวลาปัจจุบัน
        selectors.push({ selector: newVal, timestamp: Date.now() });

        chrome.storage.local.set({ [host]: selectors }, () => {
          editModal.style.display = "none";
          currentEditData = null;
        });
      });
    } else if (currentEditData.mode === "edit") {
      const { hostname, index, selectors } = currentEditData;

      let normalizedSelectors = selectors.map((s) =>
        typeof s === "string" ? { selector: s, timestamp: Date.now() } : s
      );
      normalizedSelectors[index] = {
        selector: newVal,
        timestamp: normalizedSelectors[index].timestamp || Date.now()
      };

      chrome.storage.local.set({ [hostname]: normalizedSelectors }, () => {
        editModal.style.display = "none";
        currentEditData = null;
      });
    }
  });

  cancelBtn.addEventListener("click", () => {
    editModal.style.display = "none";
    currentEditData = null;
  });

  let isMouseDownInside = false;

  if (modalBox) {
    modalBox.addEventListener("mousedown", () => {
      isMouseDownInside = true;
    });
  }

  editModal.addEventListener("mousedown", (e) => {
    if (e.target === editModal) {
      isMouseDownInside = false;
    }
  });

  editModal.addEventListener("mouseup", (e) => {
    if (e.target === editModal && !isMouseDownInside) {
      editModal.style.display = "none";
      currentEditData = null;
    }
    isMouseDownInside = false;
  });

  loadAllData();
});
