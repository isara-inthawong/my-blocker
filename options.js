document.addEventListener("DOMContentLoaded", () => {
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

  let currentEditData = null;

  if (langSelect) {
    langSelect.addEventListener("change", (e) => {
      const selectedLang = e.target.value;
      chrome.storage.local.set({ preferred_lang: selectedLang }, () => {
        location.reload();
      });
    });
  }

  async function loadAllData() {
    const noHistoryMsg = await getMsg("loadingText", "Loading...");
    const addSiteBtnText = await getMsg(
      "addSiteRuleBtn",
      "+ Add Rule for this Site"
    );
    const thSelector = await getMsg("tableThSelector", "CSS Selector / Rule");
    const thManage = await getMsg("tableThManage", "Management");
    const editBtnText = await getMsg("editBtn", "Edit");
    const deleteBtnText = await getMsg("deleteBtn", "Delete");
    const confirmDelText = await getMsg(
      "confirmDeleteText",
      "Are you sure you want to delete this item?"
    );
    const websitePrefix = await getMsg("websitePrefix", "🌐 Website:");

    chrome.storage.local.get(null, (items) => {
      container.innerHTML = "";
      const keys = Object.keys(items).filter((k) => k !== "preferred_lang");

      if (keys.length === 0) {
        container.innerHTML = `<p style="color: #666;">${noHistoryMsg}</p>`;
        return;
      }

      keys.forEach((hostname) => {
        const selectors = items[hostname];
        if (!Array.isArray(selectors) || selectors.length === 0) return;

        const section = document.createElement("div");
        section.style.marginBottom = "25px";

        const siteHeader = document.createElement("div");
        siteHeader.className = "site-header";

        const link = document.createElement("a");
        link.href = `https://${hostname}`;
        link.target = "_blank";
        link.className = "site-link";
        link.textContent = `${websitePrefix} ${hostname} ↗`;
        siteHeader.appendChild(link);

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
        siteHeader.appendChild(addSiteBtn);

        section.appendChild(siteHeader);

        const table = document.createElement("table");
        table.innerHTML = `<tr><th>${thSelector}</th><th style="width: 140px; text-align:center;">${thManage}</th></tr>`;

        selectors.forEach((sel, index) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="word-break: break-all; font-family: monospace;">${sel}</td>
            <td style="text-align:center; white-space: nowrap;"></td>
          `;

          const editBtn = document.createElement("button");
          editBtn.innerHTML = `✏️ ${editBtnText}`;
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
          delBtn.innerHTML = `🗑️ ${deleteBtnText}`;
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
    });
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
