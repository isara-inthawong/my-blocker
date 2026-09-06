document.addEventListener("DOMContentLoaded", async () => {
  if (typeof getMsg === "function") {
    const elements = document.querySelectorAll("[data-i18n]");
    for (const el of elements) {
      const key = el.getAttribute("data-i18n");
      const translated = await getMsg(key);
      if (translated) el.textContent = translated;
    }

    const titleElements = document.querySelectorAll("[data-i18n-title]");
    for (const el of titleElements) {
      const key = el.getAttribute("data-i18n-title");
      const translated = await getMsg(key);
      if (translated) el.title = translated;
    }

    const placeholderElements = document.querySelectorAll(
      "[data-i18n-placeholder]"
    );
    for (const el of placeholderElements) {
      const key = el.getAttribute("data-i18n-placeholder");
      const translated = await getMsg(key);
      if (translated) el.placeholder = translated;
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;

  chrome.tabs.sendMessage(tab.id, { action: "stop_picker" }).catch(() => {});

  const url = new URL(tab.url);
  const hostname = url.hostname;

  const pickBtn = document.getElementById("pickBtn");
  const openTabBtn = document.getElementById("openTabBtn");
  const resetBtn = document.getElementById("resetBtn");
  const addCustomBtn = document.getElementById("addCustomBtn");
  const customInput = document.getElementById("customInput");
  const editHint = document.getElementById("editHint");
  const listEl = document.getElementById("hiddenList");

  let editingIndex = null;

  // จัดโครงสร้างให้ input และปุ่มอยู่ชิดกันแบบ Flexbox เพื่อประหยัดพื้นที่
  const inputParent = customInput.parentElement;
  if (inputParent && !inputParent.classList.contains("input-group")) {
    inputParent.style.display = "flex";
    inputParent.style.alignItems = "center";
    inputParent.style.gap = "6px";
    customInput.style.flex = "1";
    customInput.style.minWidth = "0";
  }

  // สร้างปุ่มยกเลิกการแก้ไข
  const cancelEditBtn = document.createElement("button");
  cancelEditBtn.innerHTML = "✖️";
  cancelEditBtn.className = "add-icon-btn";
  cancelEditBtn.style.display = "none";
  cancelEditBtn.style.backgroundColor = "#e4e6eb";
  addCustomBtn.parentNode.insertBefore(cancelEditBtn, addCustomBtn.nextSibling);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[hostname]) {
      loadList();
    }
  });

  function cleanItemsData(rawItems) {
    if (!Array.isArray(rawItems)) return [];

    let items = rawItems
      .map((item) => {
        let sel = typeof item === "string" ? item : item.selector || "";
        return {
          selector: sel.trim(),
          timestamp: item.timestamp || Date.now()
        };
      })
      .filter((item) => item.selector !== "");

    let uniqueMap = new Map();
    items.forEach((item) => {
      if (!uniqueMap.has(item.selector)) {
        uniqueMap.set(item.selector, item);
      } else {
        if (
          (item.timestamp || 0) > (uniqueMap.get(item.selector).timestamp || 0)
        ) {
          uniqueMap.set(item.selector, item);
        }
      }
    });

    let cleanedArray = Array.from(uniqueMap.values());
    cleanedArray.sort((a, b) => b.timestamp - a.timestamp);

    return cleanedArray;
  }

  async function loadList() {
    chrome.storage.local.get([hostname], async (result) => {
      let rawItems = result[hostname] || [];
      let cleanItems = cleanItemsData(rawItems);

      if (JSON.stringify(cleanItems) !== JSON.stringify(rawItems)) {
        chrome.storage.local.set({ [hostname]: cleanItems });
        return;
      }

      let itemsWithIndex = cleanItems.map((item, originalIndex) => ({
        ...item,
        originalIndex
      }));

      listEl.innerHTML = "";
      if (itemsWithIndex.length === 0) {
        const noItemsMsg = await getMsg("noItemsText", "No hidden items yet");
        listEl.innerHTML = `<li style="justify-content:center; color:#999; cursor:default; border:none; background:transparent;" data-i18n="noItemsText">${noItemsMsg}</li>`;
      } else {
        const editTooltip = await getMsg("editBtnTooltip", "Edit this item");
        const deleteTooltip = await getMsg(
          "deleteBtnTooltip",
          "Delete this item"
        );

        itemsWithIndex.forEach((itemObj, displayIndex) => {
          const sel = itemObj.selector;
          const originalIndex = itemObj.originalIndex;

          const li = document.createElement("li");
          const span = document.createElement("span");

          // แสดงหมายเลขลำดับนำหน้า Selector (เช่น 1., 2.)
          const itemNumber = displayIndex + 1;
          span.textContent = `${itemNumber}. ${sel}`;
          span.title = sel;

          const startEditing = async () => {
            customInput.value = sel;
            editingIndex = originalIndex;
            addCustomBtn.innerHTML = "💾";
            addCustomBtn.title = await getMsg(
              "updateBtnTooltip",
              "Update this item"
            );
            addCustomBtn.className = "add-icon-btn warning";
            cancelEditBtn.style.display = "inline-flex";
            cancelEditBtn.title = await getMsg(
              "cancelBtnTooltip",
              "Cancel editing"
            );

            const editingText = await getMsg(
              "editingIndexText",
              "💡 Editing item $1"
            );
            editHint.textContent = (
              editingText || "💡 Editing item $1"
            ).replace("$1", displayIndex + 1);
            customInput.focus();
          };

          span.addEventListener("click", startEditing);

          const btnGroup = document.createElement("div");
          btnGroup.className = "btn-group";

          const editBtn = document.createElement("button");
          editBtn.innerHTML = "✏️";
          editBtn.title = editTooltip;
          editBtn.className = "icon-btn btn-edit";
          editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            startEditing();
          });

          const delBtn = document.createElement("button");
          delBtn.innerHTML = "🗑️";
          delBtn.title = deleteTooltip;
          delBtn.className = "icon-btn btn-del";
          delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            chrome.storage.local.get([hostname], (currentRes) => {
              let currentItems = cleanItemsData(currentRes[hostname] || []);
              currentItems.splice(originalIndex, 1);

              if (currentItems.length === 0) {
                chrome.storage.local.remove(hostname, () => {
                  resetEditingState();
                });
              } else {
                chrome.storage.local.set({ [hostname]: currentItems }, () => {
                  resetEditingState();
                });
              }
            });
          });

          btnGroup.appendChild(editBtn);
          btnGroup.appendChild(delBtn);
          li.appendChild(span);
          li.appendChild(btnGroup);
          listEl.appendChild(li);
        });
      }
    });
  }

  async function resetEditingState() {
    editingIndex = null;
    customInput.value = "";
    addCustomBtn.innerHTML = "➕";
    addCustomBtn.title = await getMsg("addBtnTooltip", "Add Custom Selector");
    addCustomBtn.className = "add-icon-btn";
    cancelEditBtn.style.display = "none";
    editHint.textContent = await getMsg(
      "editHintText",
      "💡 Click ✏️ on items below to edit"
    );
  }

  cancelEditBtn.addEventListener("click", () => {
    resetEditingState();
  });

  loadList();

  if (pickBtn) {
    pickBtn.addEventListener("click", () => {
      chrome.tabs.sendMessage(tab.id, { action: "start_picker" }, () => {
        window.close();
      });
    });
  }

  if (openTabBtn) {
    openTabBtn.addEventListener("click", () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL("options.html"));
      }
    });
  }

  const handleSaveOrAdd = () => {
    const val = customInput.value.trim();
    if (!val) return;

    chrome.storage.local.get([hostname], (result) => {
      let hiddenList = cleanItemsData(result[hostname] || []);

      if (
        editingIndex !== null &&
        editingIndex >= 0 &&
        editingIndex < hiddenList.length
      ) {
        hiddenList[editingIndex] = {
          selector: val,
          timestamp: Date.now()
        };
      } else {
        const existingIndex = hiddenList.findIndex(
          (item) => item.selector === val
        );
        if (existingIndex !== -1) {
          hiddenList[existingIndex].timestamp = Date.now();
        } else {
          hiddenList.push({ selector: val, timestamp: Date.now() });
        }
      }

      let finalCleanList = cleanItemsData(hiddenList);

      chrome.storage.local.set({ [hostname]: finalCleanList }, () => {
        resetEditingState();
      });
    });
  };

  if (addCustomBtn) {
    addCustomBtn.addEventListener("click", handleSaveOrAdd);
  }

  if (customInput) {
    customInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSaveOrAdd();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      chrome.storage.local.remove([hostname], () => {
        resetEditingState();
      });
    });
  }
});
