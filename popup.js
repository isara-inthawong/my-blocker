document.addEventListener("DOMContentLoaded", async () => {
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

  // แปลข้อความและ Tooltip ทั้งหมดใน popup.html ตามภาษาที่เลือก
  async function applyTranslations() {
    document.querySelector('[data-i18n="extName"]').textContent = await getMsg(
      "extName",
      "Simple Element Blocker"
    );
    document.getElementById("openTabBtn").title = await getMsg(
      "settingsTitleTooltip",
      "Open settings page"
    );
    document.getElementById("pickBtn").title = await getMsg(
      "pickBtnTooltip",
      "Click to select and hide element"
    );
    document.querySelector('[data-i18n="customSelectorLabel"]').textContent =
      await getMsg("customSelectorLabel", "Custom Selector:");
    customInput.placeholder = await getMsg(
      "customInputPlaceholder",
      "e.g. img[src$='.gif'] or div.ad-banner"
    );
    addCustomBtn.title = await getMsg("addBtnTooltip", "Add Custom Selector");
    editHint.textContent = await getMsg(
      "editHintText",
      "💡 Click ✏️ on items below to edit"
    );
    document.querySelector('[data-i18n="hiddenListLabel"]').textContent =
      await getMsg("hiddenListLabel", "Hidden items on this site:");
    document.getElementById("resetBtn").title = await getMsg(
      "resetBtnTooltip",
      "Reset all for this site"
    );
  }

  await applyTranslations();

  async function loadList() {
    chrome.storage.local.get([hostname], async (result) => {
      const items = result[hostname] || [];
      listEl.innerHTML = "";
      if (items.length === 0) {
        const noItemsMsg = await getMsg("noItemsText", "No hidden items yet");
        listEl.innerHTML = `<li style="justify-content:center; color:#999; cursor:default; border:none; background:transparent;">${noItemsMsg}</li>`;
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
