document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // สั่งปิดโหมดเลือกทันทีที่เปิด popup ขึ้นมา เพื่อป้องกันโหมดค้างหรือบังหน้าจอ
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
        listEl.innerHTML =
          '<li style="justify-content:center; color:#999; cursor:default; border:none; background:transparent;">ยังไม่มีรายการที่ซ่อน</li>';
      } else {
        items.forEach((item, index) => {
          const li = document.createElement("li");
          const span = document.createElement("span");
          span.textContent = item;
          span.title = item;

          // ฟังก์ชันสำหรับเลือกรายการเพื่อเตรียมแก้ไข
          const startEditing = () => {
            customInput.value = item;
            editingIndex = index;
            addCustomBtn.innerHTML = "💾";
            addCustomBtn.title = "อัปเดตรายการนี้";
            addCustomBtn.className = "add-icon-btn warning";
            editHint.textContent = `💡 กำลังแก้รายการที่ #${index + 1}`;
            customInput.focus();
          };

          span.addEventListener("click", startEditing);

          const btnGroup = document.createElement("div");
          btnGroup.className = "btn-group";

          // 1. ปุ่มแก้ไข (Icon พร้อม Tooltip)
          const editBtn = document.createElement("button");
          editBtn.innerHTML = "✏️";
          editBtn.title = "แก้ไขรายการนี้";
          editBtn.className = "icon-btn btn-edit";
          editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            startEditing();
          });

          // 2. ปุ่มลบ (Icon พร้อม Tooltip)
          const delBtn = document.createElement("button");
          delBtn.innerHTML = "🗑️";
          delBtn.title = "ลบรายการนี้";
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
    addCustomBtn.title = "เพิ่ม Custom Selector";
    addCustomBtn.className = "add-icon-btn";
    editHint.textContent = "💡 คลิก ✏️ รายการด้านล่างเพื่อแก้ไข";
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
