document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("storageContent");
  const langSelect = document.getElementById("langSelect");
  const searchInput = document.getElementById("searchInput");
  const paginationContainer = document.getElementById("paginationContainer");

  const addNewRuleBtn = document.getElementById("addNewRuleBtn");
  const editModal = document.getElementById("editModal");
  const cancelBtn = document.getElementById("cancelBtn");
  const saveBtn = document.getElementById("saveBtn");
  const hostnameRow = document.getElementById("hostnameRow");
  const hostnameInput = document.getElementById("hostnameInput");
  const editInput = document.getElementById("editInput");
  const modalTitle = document.getElementById("modalTitle");

  let allSavedItems = {};
  let currentPage = 1;
  const itemsPerPage = 5;

  // ตัวแปรสำหรับเก็บสถานะการแก้ไข (ระบุเว็บไซต์และลำดับของ Selector ที่กำลังแก้)
  let currentEditing = null; // รูปแบบ: { hostname, index } หรือ null ถือเป็นการสร้างใหม่

  async function safeGetMsg(key, defaultText) {
    if (typeof getMsg === "function") {
      try {
        const msg = await getMsg(key, defaultText);
        return msg || defaultText;
      } catch (e) {
        return defaultText;
      }
    }
    return defaultText;
  }

  async function renderData(items) {
    if (!container) return;
    container.innerHTML = "";
    if (paginationContainer) paginationContainer.innerHTML = "";

    const noHistoryMsg = await safeGetMsg("noItemsText", "No hidden items yet");
    const deleteAllSiteBtnText = await safeGetMsg(
      "deleteAllSiteBtn",
      "🗑️ Delete Website"
    );
    const addSiteRuleBtnText = await safeGetMsg(
      "addSiteRuleBtn",
      "+ Add Rule for this Website"
    );
    const confirmDelText = await safeGetMsg(
      "confirmDeleteText",
      "Are you sure you want to delete this item?"
    );
    const confirmDelAllText = await safeGetMsg(
      "confirmDeleteAllText",
      "Are you sure you want to delete all rules for this website?"
    );
    const thSelectorText = await safeGetMsg(
      "tableThSelector",
      "CSS Selector / Rule"
    );
    const thManageText = await safeGetMsg("tableThManage", "Action");
    const deleteBtnText = await safeGetMsg("deleteBtn", "Delete");
    const editBtnText = await safeGetMsg("editBtn", "Edit");

    let keys = Object.keys(items).filter((k) => k !== "preferred_lang");

    if (keys.length === 0) {
      container.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">${noHistoryMsg}</p>`;
      return;
    }

    const totalPages = Math.ceil(keys.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentKeys = keys.slice(startIndex, startIndex + itemsPerPage);

    currentKeys.forEach((hostname) => {
      let selectors = items[hostname];
      if (!Array.isArray(selectors)) return;

      const section = document.createElement("div");
      section.style.marginBottom = "25px";
      section.style.border = "1px solid #dadce0";
      section.style.padding = "15px";
      section.style.borderRadius = "8px";

      const siteHeader = document.createElement("div");
      siteHeader.style.display = "flex";
      siteHeader.style.justifyContent = "space-between";
      siteHeader.style.alignItems = "center";
      siteHeader.style.marginBottom = "10px";

      const link = document.createElement("a");
      link.href = `https://${hostname}`;
      link.target = "_blank";
      link.className = "site-link";
      link.textContent = `🌐 ${hostname} ↗`;
      siteHeader.appendChild(link);

      const actionGroup = document.createElement("div");
      actionGroup.style.display = "flex";
      actionGroup.style.gap = "8px";
      actionGroup.style.alignItems = "center";

      const addSiteRuleBtn = document.createElement("button");
      addSiteRuleBtn.textContent = addSiteRuleBtnText;
      addSiteRuleBtn.className = "btn-add";
      addSiteRuleBtn.style.padding = "5px 10px";
      addSiteRuleBtn.style.fontSize = "12px";
      addSiteRuleBtn.addEventListener("click", async () => {
        currentEditing = null; // โหมดสร้างกฎใหม่ให้เว็บไซต์นี้
        if (hostnameRow) hostnameRow.style.display = "none";
        if (hostnameInput) hostnameInput.value = hostname;
        if (editInput) {
          editInput.value = "";
          editInput.style.height = "110px";
        }
        const previewBox = document.getElementById("previewBox");
        if (previewBox) {
          previewBox.style.height = "110px";
          previewBox.textContent = await safeGetMsg(
            "previewPlaceholder",
            "Type selector to preview..."
          );
        }
        if (modalTitle) {
          const modalTitleAddSite = await safeGetMsg(
            "modalTitleAddSite",
            "Add CSS Selector for website: $1"
          );
          modalTitle.textContent = modalTitleAddSite.replace("$1", hostname);
        }
        editModal.style.display = "flex";
      });
      actionGroup.appendChild(addSiteRuleBtn);

      const delSiteBtn = document.createElement("button");
      delSiteBtn.textContent = deleteAllSiteBtnText;
      delSiteBtn.className = "btn-del";
      delSiteBtn.style.padding = "5px 10px";
      delSiteBtn.style.fontSize = "12px";
      delSiteBtn.addEventListener("click", () => {
        if (confirm(confirmDelAllText)) {
          chrome.storage.local.remove(hostname, loadAllData);
        }
      });
      actionGroup.appendChild(delSiteBtn);

      siteHeader.appendChild(actionGroup);
      section.appendChild(siteHeader);

      const table = document.createElement("table");
      table.innerHTML = `<tr><th>${thSelectorText}</th><th style="width: 140px; text-align:center;">${thManageText}</th></tr>`;

      selectors.forEach((selItem, index) => {
        const sel =
          typeof selItem === "object" && selItem !== null
            ? selItem.selector
            : selItem;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="word-break: break-all; font-family: monospace;">${sel || ""}</td>
          <td style="text-align:center; white-space: nowrap;"></td>
        `;

        const actionTd = tr.querySelector("td:last-child");
        actionTd.style.display = "flex";
        actionTd.style.justifyContent = "center";
        actionTd.style.gap = "5px";
        actionTd.style.alignItems = "center";

        // ปุ่มแก้ไข (Edit)
        const editBtn = document.createElement("button");
        editBtn.textContent = editBtnText;
        editBtn.className = "btn-add";
        editBtn.style.padding = "4px 8px";
        editBtn.style.fontSize = "11px";
        editBtn.addEventListener("click", async () => {
          currentEditing = { hostname, index }; // กำหนดสถานะกำลังแก้ไขรายการนี้
          if (hostnameRow) hostnameRow.style.display = "none";
          if (hostnameInput) hostnameInput.value = hostname;
          if (editInput) {
            editInput.value = sel || "";
            editInput.style.height = "110px";
          }
          const previewBox = document.getElementById("previewBox");
          if (previewBox) {
            previewBox.style.height = "110px";
            updatePreview();
          }
          if (modalTitle) {
            const modalTitleEdit = await safeGetMsg(
              "modalTitleEdit",
              "Edit CSS Selector"
            );
            modalTitle.textContent = modalTitleEdit;
          }
          editModal.style.display = "flex";
        });
        actionTd.appendChild(editBtn);

        // ปุ่มลบ (Delete)
        const delBtn = document.createElement("button");
        delBtn.textContent = deleteBtnText;
        delBtn.className = "btn-del";
        delBtn.style.padding = "4px 8px";
        delBtn.style.fontSize = "11px";
        delBtn.addEventListener("click", () => {
          if (confirm(confirmDelText)) {
            selectors.splice(index, 1);
            if (selectors.length === 0) {
              chrome.storage.local.remove(hostname, loadAllData);
            } else {
              chrome.storage.local.set({ [hostname]: selectors }, loadAllData);
            }
          }
        });
        actionTd.appendChild(delBtn);

        table.appendChild(tr);
      });

      section.appendChild(table);
      container.appendChild(section);
    });

    if (totalPages > 1 && paginationContainer) {
      const prevBtnText = await safeGetMsg("prevBtn", "◀ Prev");
      const nextBtnText = await safeGetMsg("nextBtn", "Next ▶");
      const pageOfText = await safeGetMsg("pageOfText", "Page $1 of $2");

      const prevBtn = document.createElement("button");
      prevBtn.textContent = prevBtnText;
      prevBtn.className = "btn-cancel";
      prevBtn.disabled = currentPage === 1;
      prevBtn.style.opacity = currentPage === 1 ? "0.5" : "1";
      prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          filterAndRender();
        }
      });
      paginationContainer.appendChild(prevBtn);

      const pageInfo = document.createElement("span");
      pageInfo.style.fontSize = "13px";
      pageInfo.style.fontWeight = "bold";
      pageInfo.textContent = pageOfText
        .replace("$1", currentPage)
        .replace("$2", totalPages);
      paginationContainer.appendChild(pageInfo);

      const nextBtn = document.createElement("button");
      nextBtn.textContent = nextBtnText;
      nextBtn.className = "btn-save";
      nextBtn.disabled = currentPage === totalPages;
      nextBtn.style.opacity = currentPage === totalPages ? "0.5" : "1";
      nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
          currentPage++;
          filterAndRender();
        }
      });
      paginationContainer.appendChild(nextBtn);
    }
  }

  function filterAndRender() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    if (!query) {
      renderData(allSavedItems);
      return;
    }

    let filteredItems = {};
    Object.keys(allSavedItems).forEach((hostname) => {
      if (hostname.toLowerCase().includes(query)) {
        filteredItems[hostname] = allSavedItems[hostname];
      } else {
        let selectors = allSavedItems[hostname];
        if (Array.isArray(selectors)) {
          let matchedSelectors = selectors.filter((selItem) => {
            const sel =
              typeof selItem === "object" && selItem !== null
                ? selItem.selector
                : selItem;
            return sel && sel.toLowerCase().includes(query);
          });
          if (matchedSelectors.length > 0) {
            filteredItems[hostname] = matchedSelectors;
          }
        }
      }
    });

    renderData(filteredItems);
  }

  function loadAllData() {
    if (!container) return;
    container.innerHTML =
      "<p style='text-align:center; padding:20px;'>Loading...</p>";

    chrome.storage.local.get(null, (items) => {
      try {
        allSavedItems = items || {};
        filterAndRender();
      } catch (err) {
        console.error("Render error:", err);
        container.innerHTML = `<p style="color: red; text-align: center;">Error loading data.</p>`;
      }
    });
  }

  async function refreshUI() {
    if (typeof localizePage === "function") {
      try {
        await localizePage();
      } catch (e) {}
    }
    loadAllData();
  }

  async function updatePreview() {
    const previewBox = document.getElementById("previewBox");
    if (!previewBox) return;

    const selector = editInput ? editInput.value.trim() : "";
    const placeholderMsg = await safeGetMsg(
      "previewPlaceholder",
      "Type selector to preview..."
    );

    if (!selector) {
      previewBox.textContent = placeholderMsg;
      return;
    }

    const corsText = await safeGetMsg(
      "corsBypassText",
      "ℹ️ Live preview skipped (CORS policy), but it will still work normally."
    );
    previewBox.innerHTML = `
      <span style="color: #1a73e8; font-weight: bold;">ℹ️ CSS Selector Ready:</span><br>
      <span style="color: #444; font-family: monospace; display: block; margin-top: 4px;">${selector}</span>
      <span style="color: #666; font-size: 10px; display: block; margin-top: 6px;">${corsText}</span>
    `;
  }

  if (addNewRuleBtn && editModal) {
    addNewRuleBtn.addEventListener("click", async () => {
      currentEditing = null; // สร้างใหม่ทั้งหมด
      if (hostnameRow) hostnameRow.style.display = "flex";
      if (hostnameInput) hostnameInput.value = "";
      if (editInput) {
        editInput.value = "";
        editInput.style.height = "110px";
      }
      const previewBox = document.getElementById("previewBox");
      if (previewBox) {
        previewBox.style.height = "110px";
        previewBox.textContent = await safeGetMsg(
          "previewPlaceholder",
          "Type selector to preview..."
        );
      }
      if (modalTitle)
        modalTitle.textContent = await safeGetMsg(
          "modalTitleNewSite",
          "Add New Website & Selector"
        );
      editModal.style.display = "flex";
    });
  }

  if (cancelBtn && editModal) {
    cancelBtn.addEventListener("click", () => {
      editModal.style.display = "none";
      currentEditing = null;
    });
  }

  if (saveBtn && editModal) {
    saveBtn.addEventListener("click", async () => {
      let rawHost = hostnameInput ? hostnameInput.value.trim() : "";
      const selectorText = editInput ? editInput.value.trim() : "";

      const alertHostMsg = await safeGetMsg(
        "alertEmptyHostname",
        "Please enter a valid website hostname"
      );
      const alertSelectorMsg = await safeGetMsg(
        "alertEmptySelector",
        "Please enter a CSS Selector"
      );

      if (!rawHost) {
        alert(alertHostMsg);
        return;
      }
      if (!selectorText) {
        alert(alertSelectorMsg);
        return;
      }

      const host = rawHost
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .toLowerCase();

      chrome.storage.local.get([host], (result) => {
        let existingList = result[host] || [];
        if (!Array.isArray(existingList)) existingList = [];

        existingList = existingList.map((item) =>
          typeof item === "string"
            ? { selector: item, timestamp: Date.now() }
            : item
        );

        if (currentEditing && currentEditing.hostname === host) {
          // กรณีแก้ไขรายการเดิมที่มีอยู่
          const index = currentEditing.index;
          if (index >= 0 && index < existingList.length) {
            existingList[index] = {
              selector: selectorText,
              timestamp: Date.now()
            };
          } else {
            existingList.push({
              selector: selectorText,
              timestamp: Date.now()
            });
          }
        } else {
          // กรณีเพิ่มใหม่ หรือเปลี่ยนโฮสต์
          const exists = existingList.some(
            (item) => item.selector === selectorText
          );
          if (!exists) {
            existingList.push({
              selector: selectorText,
              timestamp: Date.now()
            });
          }
        }

        chrome.storage.local.set({ [host]: existingList }, () => {
          editModal.style.display = "none";
          currentEditing = null;
          loadAllData();
        });
      });
    });
  }

  if (editInput) {
    editInput.addEventListener("input", () => {
      editInput.style.height = "auto";
      editInput.style.height = editInput.scrollHeight + "px";

      const previewBox = document.getElementById("previewBox");
      if (previewBox) {
        previewBox.style.height = editInput.style.height;
      }

      updatePreview();
    });
  }

  if (hostnameInput) {
    hostnameInput.addEventListener("input", () => {
      updatePreview();
    });
  }

  if (langSelect) {
    chrome.storage.local.get("preferred_lang", (data) => {
      if (data.preferred_lang) {
        langSelect.value = data.preferred_lang;
      }
    });

    langSelect.addEventListener("change", async (e) => {
      const selectedLang = e.target.value;
      chrome.storage.local.set({ preferred_lang: selectedLang }, async () => {
        await refreshUI();
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentPage = 1;
      filterAndRender();
    });
  }

  // ฟังเหตุการณ์เมื่อมีการเปลี่ยนแปลงข้อมูลใน Storage จากหน้าอื่น (เช่น Popup)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      loadAllData();
    }
  });

  await refreshUI();
});
