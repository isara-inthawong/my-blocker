document.addEventListener("DOMContentLoaded", async () => {
  // แปลภาษาอัตโนมัติสำหรับทุก Element ที่มี data-i18n, data-i18n-title และ data-i18n-placeholder
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

  // ฟังเหตุการณ์เมื่อข้อมูลใน storage เปลี่ยนแปลง ให้โหลดรายการใน Popup ใหม่ทันที
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[hostname]) {
      loadList();
    }
  });

  async function loadList() {
    chrome.storage.local.get([hostname], async (result) => {
      const items = result[hostname] || [];
      listEl.innerHTML = "";
      if (items.length === 0) {
        const noItemsMsg = await getMsg("noItemsText", "No hidden items yet");
        listEl.innerHTML = `<li style="justify-content:center; color:#999; cursor:default; border:none; background:transparent;" data-i18n="noItemsText">${noItemsMsg}</li>`;
      } else {
        const editTooltip = await getMsg("editBtnTooltip", "Edit this item");
        const deleteTooltip = await getMsg(
          "deleteBtnTooltip",
          "Delete this item"
        );

        items.forEach((item, index) => {
          const li = document.createElement("li");
          const span = document.createElement("span");
          span.textContent = item;
          span.title = item;

          const startEditing = async () => {
            customInput.value = item;
            editingIndex = index;
            addCustomBtn.innerHTML = "💾";
            addCustomBtn.title = await getMsg(
              "updateBtnTooltip",
              "Update this item"
            );
            addCustomBtn.className = "add-icon-btn warning";
            const editingText = await getMsg(
              "editingIndexText",
              "💡 Editing item #"
            );
            editHint.textContent = editingText.replace("$1", index + 1);
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
            items.splice(index, 1);
            chrome.storage.local.set({ [hostname]: items }, () => {
              resetEditingState();
              loadList();
              chrome.tabs.reload(tab.id);
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
    editHint.textContent = await getMsg(
      "editHintText",
      "💡 Click ✏️ on items below to edit"
    );
  }

  loadList();

  pickBtn.addEventListener("click", () => {
    chrome.tabs.sendMessage(tab.id, { action: "start_picker" }, () => {
      window.close();
    });
  });

  openTabBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  addCustomBtn.addEventListener("click", () => {
    const val = customInput.value.trim();
    if (!val) return;

    chrome.storage.local.get([hostname], (result) => {
      let hiddenList = result[hostname] || [];
      if (editingIndex !== null && editingIndex >= 0) {
        hiddenList[editingIndex] = val;
      } else {
        if (!hiddenList.includes(val)) hiddenList.push(val);
      }

      chrome.storage.local.set({ [hostname]: hiddenList }, () => {
        resetEditingState();
        loadList();
        chrome.tabs.reload(tab.id);
      });
    });
  });

  customInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addCustomBtn.click();
  });

  resetBtn.addEventListener("click", () => {
    chrome.storage.local.remove([hostname], () => {
      resetEditingState();
      loadList();
      chrome.tabs.reload(tab.id);
    });
  });
});
