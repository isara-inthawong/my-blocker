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

  function loadList() {
    chrome.storage.local.get([hostname], (result) => {
      const items = result[hostname] || [];
      listEl.innerHTML = "";
      if (items.length === 0) {
        listEl.innerHTML = `<li style="justify-content:center; color:#999; cursor:default; border:none; background:transparent;" data-i18n="noItemsText">${chrome.i18n.getMessage("noItemsText") || "No hidden items yet"}</li>`;
      } else {
        items.forEach((item, index) => {
          const li = document.createElement("li");
          const span = document.createElement("span");
          span.textContent = item;
          span.title = item;

          const startEditing = () => {
            customInput.value = item;
            editingIndex = index;
            addCustomBtn.innerHTML = "💾";
            addCustomBtn.title =
              chrome.i18n.getMessage("updateBtnTooltip") || "Update this item";
            addCustomBtn.className = "add-icon-btn warning";
            editHint.textContent = (
              chrome.i18n.getMessage("editingIndexText") || "💡 Editing item #"
            ).replace("$1", index + 1);
            customInput.focus();
          };

          span.addEventListener("click", startEditing);

          const btnGroup = document.createElement("div");
          btnGroup.className = "btn-group";

          const editBtn = document.createElement("button");
          editBtn.innerHTML = "✏️";
          editBtn.title =
            chrome.i18n.getMessage("editBtnTooltip") || "Edit this item";
          editBtn.className = "icon-btn btn-edit";
          editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            startEditing();
          });

          const delBtn = document.createElement("button");
          delBtn.innerHTML = "🗑️";
          delBtn.title =
            chrome.i18n.getMessage("deleteBtnTooltip") || "Delete this item";
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

  function resetEditingState() {
    editingIndex = null;
    customInput.value = "";
    addCustomBtn.innerHTML = "➕";
    addCustomBtn.title =
      chrome.i18n.getMessage("addBtnTooltip") || "Add Custom Selector";
    addCustomBtn.className = "add-icon-btn";
    editHint.textContent =
      chrome.i18n.getMessage("editHintText") ||
      "💡 Click ✏️ on items below to edit";
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
