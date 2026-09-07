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
  const previewBox = document.getElementById("previewBox");

  let allSavedItems = {};
  let currentPage = 1;
  const itemsPerPage = 5;

  let currentEditing = null;

  // ดักจับปุ่ม ESC เพื่อปิด Modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && editModal && editModal.style.display === "flex") {
      editModal.style.display = "none";
      currentEditing = null;
    }
  });

  // ฟังก์ชันส่งสัญญาณบอก content.js ให้รีเฟรชการซ่อน element ของ hostname นั้นๆ
  function notifyContentScript(hostname) {
    if (!hostname) return;
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.url && tab.url.toLowerCase().includes(hostname.toLowerCase())) {
          chrome.tabs.sendMessage(
            tab.id,
            { action: "refreshHiddenElements" },
            () => {
              if (chrome.runtime.lastError) {
                // ignore
              }
            }
          );
        }
      });
    });
  }

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

  // ฟังก์ชันทำความสะอาดและป้องกันข้อมูลซ้ำซ้อน
  function cleanItemsData(rawItems) {
    if (!Array.isArray(rawItems)) return [];

    let uniqueMap = new Map();
    rawItems.forEach((item) => {
      let sel = typeof item === "string" ? item : item.selector || "";
      sel = sel.trim();
      if (sel !== "") {
        let timestamp =
          typeof item === "object" && item !== null && item.timestamp
            ? item.timestamp
            : Date.now();
        if (!uniqueMap.has(sel)) {
          uniqueMap.set(sel, { selector: sel, timestamp: timestamp });
        } else {
          // เก็บตัวที่มี timestamp ล่าสุดกว่า
          if (timestamp > uniqueMap.get(sel).timestamp) {
            uniqueMap.set(sel, { selector: sel, timestamp: timestamp });
          }
        }
      }
    });

    let cleanedArray = Array.from(uniqueMap.values());
    cleanedArray.sort((a, b) => b.timestamp - a.timestamp);
    return cleanedArray;
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
    const websitePrefixText = await safeGetMsg("websitePrefix", "🌐 Website:");

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
      let selectors = cleanItemsData(items[hostname]);
      if (selectors.length === 0) return;

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

      const linkContainer = document.createElement("div");
      linkContainer.style.display = "flex";
      linkContainer.style.alignItems = "center";
      linkContainer.style.gap = "6px";

      const prefixSpan = document.createElement("span");
      prefixSpan.textContent = websitePrefixText;
      linkContainer.appendChild(prefixSpan);

      const link = document.createElement("a");
      link.href = `https://${hostname}`;
      link.target = "_blank";
      link.style.color = "#1a73e8";
      link.style.textDecoration = "none";
      link.style.fontWeight = "bold";
      link.textContent = `${hostname} ↗`;
      link.addEventListener(
        "mouseover",
        () => (link.style.textDecoration = "underline")
      );
      link.addEventListener(
        "mouseout",
        () => (link.style.textDecoration = "none")
      );
      linkContainer.appendChild(link);

      siteHeader.appendChild(linkContainer);

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
        currentEditing = null;
        if (hostnameRow) hostnameRow.style.display = "none";
        if (hostnameInput) hostnameInput.value = hostname;
        if (editInput) {
          editInput.value = "";
          editInput.style.height = "110px";
        }
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
          chrome.storage.local.remove(hostname, () => {
            notifyContentScript(hostname);
          });
        }
      });
      actionGroup.appendChild(delSiteBtn);

      siteHeader.appendChild(actionGroup);
      section.appendChild(siteHeader);

      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.tableLayout = "fixed";
      table.innerHTML = `
        <thead>
          <tr>
            <th style="width: 80%;">${thSelectorText}</th>
            <th style="width: 20%; text-align: center; vertical-align: middle;">${thManageText}</th>
          </tr>
        </thead>
      `;

      selectors.forEach((selItem, index) => {
        const sel = selItem.selector;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="word-break: break-all; word-wrap: break-word; font-family: monospace; vertical-align: middle; padding: 10px;">${sel || ""}</td>
          <td style="text-align: center; vertical-align: middle; white-space: nowrap; padding: 10px;"></td>
        `;

        const actionTd = tr.querySelector("td:last-child");

        const editBtn = document.createElement("button");
        editBtn.textContent = editBtnText;
        editBtn.className = "btn-add";
        editBtn.style.padding = "5px 10px";
        editBtn.style.fontSize = "11px";
        editBtn.style.marginRight = "5px";
        editBtn.addEventListener("click", async () => {
          currentEditing = { hostname, index };
          if (hostnameRow) hostnameRow.style.display = "none";
          if (hostnameInput) hostnameInput.value = hostname;
          if (editInput) {
            editInput.value = sel || "";
            editInput.style.height = "110px";
          }
          if (previewBox) {
            previewBox.style.height = "110px";
            updatePreview();
          }
          if (modalTitle) {
            const modalTitleEdit = await safeGetMsg(
              "modalTitleEdit",
              "Edit CSS Selector for website: $1"
            );
            modalTitle.textContent = modalTitleEdit.replace("$1", hostname);
          }
          editModal.style.display = "flex";
        });
        actionTd.appendChild(editBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = deleteBtnText;
        delBtn.className = "btn-del";
        delBtn.style.padding = "5px 10px";
        delBtn.style.fontSize = "11px";
        delBtn.addEventListener("click", () => {
          selectors.splice(index, 1);
          if (selectors.length === 0) {
            chrome.storage.local.remove(hostname, () => {
              notifyContentScript(hostname);
            });
          } else {
            chrome.storage.local.set({ [hostname]: selectors }, () => {
              notifyContentScript(hostname);
            });
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

  // ฟังก์ชันป้องกัน XSS เบื้องต้นสำหรับการแสดงผล HTML Tag
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function updatePreview() {
    if (!previewBox) return;

    const selector = editInput ? editInput.value.trim() : "";
    const placeholderMsg = await safeGetMsg(
      "previewPlaceholder",
      "Type selector to preview..."
    );

    if (!selector) {
      previewBox.textContent = placeholderMsg;
      previewBox.style.display = "flex";
      previewBox.style.alignItems = "center";
      previewBox.style.justifyContent = "center";
      previewBox.style.color = "#80868b";
      previewBox.style.overflowY = "hidden";
      return;
    }

    let targetHost = hostnameInput ? hostnameInput.value.trim() : "";
    if (!targetHost && currentEditing) {
      targetHost = currentEditing.hostname;
    }
    targetHost = targetHost
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .toLowerCase();

    const searchingText = await safeGetMsg(
      "loadingPreviewText",
      "Searching information..."
    );
    previewBox.style.display = "block";
    previewBox.style.overflowY = "hidden";
    previewBox.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #5f6368; font-size: 13px;">
        <span>⏳ ${searchingText}</span>
      </div>
    `;

    chrome.tabs.query({}, (tabs) => {
      const targetTab = tabs.find(
        (tab) => tab.url && tab.url.toLowerCase().includes(targetHost)
      );

      if (!targetTab) {
        previewBox.style.overflowY = "auto";
        previewBox.innerHTML = `
          <div style="padding: 10px; font-size: 12px; line-height: 1.5;">
            <div style="color: #1a73e8; font-weight: bold; margin-bottom: 4px;">📌 CSS Selector:</div>
            <div style="color: #202124; font-family: monospace; background: #f1f3f4; padding: 6px 8px; border-radius: 4px; word-break: break-all; margin-bottom: 8px; border: 1px solid #dfe1e5;">${escapeHtml(selector)}</div>
            <div style="color: #d93025; font-size: 11px; background: #fce8e6; padding: 6px 8px; border-radius: 4px;">⚠️ เปิดหน้าเว็บ <b>${targetHost || "เป้าหมาย"}</b> ค้างไว้เพื่อดูตัวอย่างแบบ Real-time</div>
          </div>
        `;
        return;
      }

      chrome.tabs.sendMessage(
        targetTab.id,
        { action: "previewSelector", selector: selector },
        async (response) => {
          if (
            chrome.runtime.lastError ||
            !response ||
            !response.elements ||
            response.elements.length === 0
          ) {
            const noFoundText = await safeGetMsg(
              "noTagFoundText",
              "No elements found matching this selector."
            );
            previewBox.style.overflowY = "hidden";
            previewBox.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #d93025; font-size: 12px; text-align: center; padding: 10px;">
                <span>❌ ${noFoundText}</span>
              </div>
            `;
            return;
          }

          const excludeBtnText = await safeGetMsg("excludeBtn", "Exclude");

          let htmlList = response.elements
            .map((el, idx) => {
              return `
                <div style="display: flex; align-items: stretch; background: #ffffff; margin-bottom: 6px; border-radius: 4px; border: 1px solid #e0e0e0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); overflow: hidden;">
                  <div style="flex: 1; font-family: monospace; font-size: 11px; padding: 6px 8px; word-break: break-all; color: #202124; display: flex; align-items: center;">${escapeHtml(el)}</div>
                  <button class="exclude-item-btn" data-index="${idx}" style="background: #f1f3f4; border: none; border-left: 1px solid #e0e0e0; color: #d93025; font-size: 11px; font-weight: bold; padding: 0 10px; cursor: pointer; white-space: nowrap; transition: background 0.2s;">${excludeBtnText}</button>
                </div>
              `;
            })
            .join("");

          const foundText = await safeGetMsg(
            "previewFoundCount",
            "Found $1 items:"
          );
          const titleText = foundText.replace("$1", response.elements.length);

          previewBox.style.overflowY = "auto";
          previewBox.innerHTML = `
            <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px; color: #1a73e8; display: flex; align-items: center; justify-content: space-between;">
              <span>✨ ${titleText}</span>
            </div>
            <div>${htmlList}</div>
          `;

          // ผูก Event ให้ปุ่ม Exclude ของแต่ละรายการ
          const excludeButtons =
            previewBox.querySelectorAll(".exclude-item-btn");
          excludeButtons.forEach((btn) => {
            btn.addEventListener(
              "mouseover",
              () => (btn.style.background = "#fce8e6")
            );
            btn.addEventListener(
              "mouseout",
              () => (btn.style.background = "#f1f3f4")
            );
            btn.addEventListener("click", () => {
              const idx = parseInt(btn.getAttribute("data-index"), 10);
              const targetEl = response.elements[idx];
              if (editInput && targetEl) {
                let currentSel = editInput.value.trim();
                if (!currentSel.includes(`:not(${targetEl})`)) {
                  editInput.value = `${currentSel}:not([alt="${targetEl.match(/alt="([^"]+)"/)?.[1] || ""}"])`;
                }
                updatePreview();
              }
            });
          });
        }
      );
    });
  }

  if (editInput && previewBox) {
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === editInput) {
          previewBox.style.height = `${entry.target.offsetHeight}px`;
        }
      }
    });
    resizeObserver.observe(editInput);
  }

  if (addNewRuleBtn && editModal) {
    addNewRuleBtn.addEventListener("click", async () => {
      currentEditing = null;
      if (hostnameRow) hostnameRow.style.display = "flex";
      if (hostnameInput) hostnameInput.value = "";
      if (editInput) {
        editInput.value = "";
        editInput.style.height = "110px";
      }
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
        let existingList = cleanItemsData(result[host] || []);

        if (currentEditing && currentEditing.hostname === host) {
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
          const existsIndex = existingList.findIndex(
            (item) => item.selector === selectorText
          );
          if (existsIndex !== -1) {
            existingList[existsIndex].timestamp = Date.now();
          } else {
            existingList.push({
              selector: selectorText,
              timestamp: Date.now()
            });
          }
        }

        let finalCleanList = cleanItemsData(existingList);

        editModal.style.display = "none";
        currentEditing = null;
        chrome.storage.local.set({ [host]: finalCleanList }, () => {
          notifyContentScript(host);
        });
      });
    });
  }

  if (editInput) {
    editInput.addEventListener("input", () => {
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

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      const keys = Object.keys(changes);
      if (keys.length === 1 && keys[0] === "preferred_lang") {
        return;
      }
      loadAllData();
    }
  });

  await refreshUI();
});
