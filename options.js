document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("storageContent");
  const editModal = document.getElementById("editModal");
  const modalBox = editModal.querySelector(".modal"); // อ้างอิงกล่องสีขาวข้างใน
  const modalTitle = document.getElementById("modalTitle");
  const hostnameRow = document.getElementById("hostnameRow");
  const hostnameInput = document.getElementById("hostnameInput");
  const editInput = document.getElementById("editInput");
  const previewBox = document.getElementById("previewBox");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const addNewRuleBtn = document.getElementById("addNewRuleBtn");

  let currentEditData = null;

  function loadAllData() {
    chrome.storage.local.get(null, (items) => {
      container.innerHTML = "";
      const keys = Object.keys(items);

      if (keys.length === 0) {
        container.innerHTML =
          '<p style="color: #666;">ยังไม่มีประวัติการบล็อกในเว็บไซต์ใดๆ</p>';
        return;
      }

      keys.forEach((hostname) => {
        const selectors = items[hostname];
        if (!Array.isArray(selectors) || selectors.length === 0) return;

        const section = document.createElement("div");
        section.style.marginBottom = "25px";

        // ส่วนหัวข้อเว็บไซต์ พร้อมปุ่มเพิ่ม Rule ของเว็บนี้
        const siteHeader = document.createElement("div");
        siteHeader.className = "site-header";

        const link = document.createElement("a");
        link.href = `https://${hostname}`;
        link.target = "_blank";
        link.className = "site-link";
        link.textContent = `🌐 เว็บไซต์: ${hostname} ↗`;
        siteHeader.appendChild(link);

        const addSiteBtn = document.createElement("button");
        addSiteBtn.textContent = "+ เพิ่ม Rule ของเว็บนี้";
        addSiteBtn.className = "btn-site-add";
        addSiteBtn.addEventListener("click", () => {
          currentEditData = { mode: "add-to-site", hostname };
          modalTitle.textContent = `เพิ่ม CSS Selector ให้กับเว็บไซต์: ${hostname}`;
          hostnameRow.style.display = "block";
          hostnameInput.value = hostname;
          hostnameInput.readOnly = true; // ล็อกไม่ให้แก้ชื่อเว็บ
          editInput.value = "";
          previewBox.innerHTML = "พิมพ์ Selector เพื่อดูตัวอย่าง...";
          editModal.style.display = "flex";
          editInput.focus();
        });
        siteHeader.appendChild(addSiteBtn);

        section.appendChild(siteHeader);

        const table = document.createElement("table");
        table.innerHTML = `<tr><th>CSS Selector / Rule</th><th style="width: 140px; text-align:center;">จัดการ</th></tr>`;

        selectors.forEach((sel, index) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="word-break: break-all; font-family: monospace;">${sel}</td>
            <td style="text-align:center; white-space: nowrap;"></td>
          `;

          const editBtn = document.createElement("button");
          editBtn.textContent = "แก้ไข";
          editBtn.className = "btn-edit";
          editBtn.addEventListener("click", () => {
            currentEditData = { mode: "edit", hostname, index, selectors };
            modalTitle.textContent = "แก้ไข CSS Selector";
            hostnameRow.style.display = "block";
            hostnameInput.value = hostname;
            hostnameInput.readOnly = true;
            editInput.value = sel;
            editModal.style.display = "flex";
            updatePreview(hostname, sel);
            editInput.focus();
          });

          const delBtn = document.createElement("button");
          delBtn.textContent = "ลบ";
          delBtn.className = "btn-del";
          delBtn.addEventListener("click", () => {
            if (confirm("ต้องการลบรายการนี้ใช่หรือไม่?")) {
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
    });
  }

  // กดปุ่มเพิ่มเว็บใหม่ทั้งหมด
  addNewRuleBtn.addEventListener("click", () => {
    currentEditData = { mode: "add-new-site" };
    modalTitle.textContent = "เพิ่มเว็บไซต์และ CSS Selector ใหม่";
    hostnameRow.style.display = "block";
    hostnameInput.value = "";
    hostnameInput.readOnly = false; // ปลดล็อกให้พิมพ์ชื่อเว็บเองได้
    editInput.value = "";
    previewBox.innerHTML = "พิมพ์ Selector เพื่อดูตัวอย่าง...";
    editModal.style.display = "flex";
    hostnameInput.focus();
  });

  async function updatePreview(hostname, selector) {
    if (!hostname || !selector) return;
    previewBox.innerHTML = "กำลังค้นหาข้อมูล...";
    try {
      const response = await fetch(`https://${hostname}`, { mode: "cors" });
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");

      const matches = doc.querySelectorAll(selector);
      previewBox.innerHTML = "";

      if (matches.length === 0) {
        previewBox.innerHTML =
          '<span style="color: #666;">ไม่พบแท็กในหน้าแรก (สามารถกดบันทึกใช้งานจริงได้ปกติ)</span>';
        return;
      }

      matches.forEach((el, idx) => {
        if (idx < 10) {
          const item = document.createElement("div");
          item.className = "preview-item";
          item.style.display = "flex";
          item.style.justifyContent = "space-between";
          item.style.alignItems = "center";

          // ข้อความแสดงโค้ดตัวอย่าง
          const textSpan = document.createElement("span");
          const snippet =
            el.outerHTML.substring(0, 100) +
            (el.outerHTML.length > 100 ? "..." : "");
          textSpan.textContent = snippet;
          textSpan.style.flex = "1";
          textSpan.style.wordBreak = "break-all";
          item.appendChild(textSpan);

          // ปุ่มสำหรับกด "ยกเว้น" รายการนี้
          const excludeBtn = document.createElement("button");
          excludeBtn.textContent = "ยกเว้น";
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
      previewBox.innerHTML =
        '<span style="color: #1a73e8;">ℹ️ ข้ามการแสดงตัวอย่างสด (ติดมาตรการ CORS) แต่สามารถกดบันทึกใช้งานจริงได้ปกติครับ</span>';
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

  saveBtn.addEventListener("click", () => {
    if (!currentEditData) return;
    const newVal = editInput.value.trim();
    if (newVal === "") {
      alert("กรุณากรอก CSS Selector");
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
        alert("กรุณากรอกชื่อเว็บไซต์ (Hostname) ให้ถูกต้อง");
        return;
      }

      chrome.storage.local.get([host], (result) => {
        let selectors = result[host] || [];
        selectors.push(newVal);
        chrome.storage.local.set({ [host]: selectors }, () => {
          editModal.style.display = "none";
          currentEditData = null;
          loadAllData();
        });
      });
    } else if (currentEditData.mode === "edit") {
      const { hostname, index, selectors } = currentEditData;
      selectors[index] = newVal;
      chrome.storage.local.set({ [hostname]: selectors }, () => {
        editModal.style.display = "none";
        currentEditData = null;
        loadAllData();
      });
    }
  });

  cancelBtn.addEventListener("click", () => {
    editModal.style.display = "none";
    currentEditData = null;
  });

  // ป้องกันการปิด Modal เมื่อลากเมาส์ขยาย Textarea ออกนอกกรอบ
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

  // ปรับขนาด previewBox ให้เท่ากับ textarea อัตโนมัติเมื่อมีการลากขยาย
  if (editInput && previewBox) {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        previewBox.style.height = `${entry.contentRect.height}px`;
      }
    });
    observer.observe(editInput);
  }

  loadAllData();
});
