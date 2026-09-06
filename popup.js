document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
          '<li style="justify-content:center; color:#999; cursor:default;">ยังไม่มีรายการที่ซ่อน</li>';
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
            addCustomBtn.textContent = "อัปเดต";
            addCustomBtn.className = "warning";
            editHint.textContent = `💡 กำลังแก้รายการที่ #${index + 1}`;
            customInput.focus();
          };

          span.addEventListener("click", startEditing);

          const btnGroup = document.createElement("div");
          btnGroup.className = "btn-group";

          // 1. เพิ่มปุ่มแก้ไข (สีเหลือง)
          const editBtn = document.createElement("button");
          editBtn.textContent = "แก้ไข";
          editBtn.className = "btn-edit warning";
          editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            startEditing();
          });

          // 2. ปุ่มลบ (สีแดง)
          const delBtn = document.createElement("button");
          delBtn.textContent = "ลบ";
          delBtn.className = "btn-del";
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
    addCustomBtn.textContent = "เพิ่ม";
    addCustomBtn.className = "";
    editHint.textContent = "💡 คลิกรายการด้านล่างเพื่อแก้ไข";
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
