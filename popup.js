document.addEventListener("DOMContentLoaded", async () => {
  // ฟังก์ชันสำหรับแปลงภาษา element ภายใน popup
  async function localizePopupElements() {
    if (typeof localizePage === "function") {
      await localizePage();
    }
  }

  await localizePopupElements();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;

  if (tab.url && tab.url.startsWith("http")) {
    chrome.tabs.sendMessage(tab.id, { action: "stop_picker" }).catch(() => {});
  }

  const url = new URL(tab.url);
  const hostname = url.hostname;

  const pickBtn = document.getElementById("pickBtn");
  const openTabBtn = document.getElementById("openTabBtn");
  const resetBtn = document.getElementById("resetBtn");
  const addCustomBtn = document.getElementById("addCustomBtn");
  const customInput = document.getElementById("customInput");
  const editHint = document.getElementById("editHint");
  const listEl = document.getElementById("hiddenList");

  // อ้างอิง Element ปุ่มเปิด/ปิด Auto Pick จากไฟล์ popup.html ที่มีอยู่แล้ว
  const autoStatusText = document.getElementById("autoStatusText");
  const toggleAutoBtn = document.getElementById("toggleAutoBtn");

  let editingIndex = null;

  // ฟังก์ชันส่งสัญญาณให้ Content Script อัปเดตการซ่อน Element ทันที
  async function triggerTabRefresh() {
    if (tab && tab.id && tab.url && tab.url.startsWith("http")) {
      chrome.tabs
        .sendMessage(tab.id, { action: "refreshHiddenElements" })
        .catch(() => {});
    }
  }

  // โหลดและจัดการสถานะ Auto Pick ของเว็บไซต์นี้
  chrome.storage.local.get(["disabled_auto_hosts"], async (data) => {
    let disabledHosts = data.disabled_auto_hosts || [];
    let isDisabled = disabledHosts.includes(hostname);

    await updateAutoUI(isDisabled);

    if (toggleAutoBtn) {
      toggleAutoBtn.addEventListener("click", () => {
        chrome.storage.local.get(
          ["disabled_auto_hosts"],
          async (latestData) => {
            let currentDisabled = latestData.disabled_auto_hosts || [];
            let currentlyDisabled = currentDisabled.includes(hostname);

            if (currentlyDisabled) {
              currentDisabled = currentDisabled.filter((h) => h !== hostname);
            } else {
              currentDisabled.push(hostname);
            }

            chrome.storage.local.set(
              { disabled_auto_hosts: currentDisabled },
              async () => {
                await updateAutoUI(!currentlyDisabled);
                triggerTabRefresh();
              }
            );
          }
        );
      });
    }
  });

  async function updateAutoUI(isDisabled) {
    if (!autoStatusText || !toggleAutoBtn) return;
    if (isDisabled) {
      autoStatusText.textContent = await getMsg(
        "autoPickStatusOff",
        "🤖 Auto Pick เว็บนี้: ปิดอยู่"
      );
      toggleAutoBtn.textContent = await getMsg(
        "autoPickTurnOnBtn",
        "เปิด Auto"
      );
      toggleAutoBtn.style.background = "#1a73e8";
    } else {
      autoStatusText.textContent = await getMsg(
        "autoPickStatusOn",
        "🤖 Auto Pick เว็บนี้: เปิดอยู่"
      );
      toggleAutoBtn.textContent = await getMsg(
        "autoPickTurnOffBtn",
        "ปิด Auto"
      );
      toggleAutoBtn.style.background = "#d93025";
    }
  }

  // จัดโครงสร้างให้ input และปุ่มอยู่ชิดกันแบบ Flexbox เพื่อประหยัดพื้นที่
  const inputParent = customInput ? customInput.parentElement : null;
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
  if (addCustomBtn && addCustomBtn.parentNode) {
    addCustomBtn.parentNode.insertBefore(
      cancelEditBtn,
      addCustomBtn.nextSibling
    );
  }

  // ดักฟังการเปลี่ยนภาษาหรือข้อมูลใน storage แบบเรียลไทม์
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "local") {
      if (changes.preferred_lang) {
        await localizePopupElements();
        chrome.storage.local.get(["disabled_auto_hosts"], async (data) => {
          let disabledHosts = data.disabled_auto_hosts || [];
          await updateAutoUI(disabledHosts.includes(hostname));
        });
        await resetEditingState();
        loadList();
      }
      if (changes[hostname]) {
        loadList();
      }
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

      // จัดการซ่อนหรือแสดงปุ่ม Reset ตามจำนวนรายการ
      if (resetBtn) {
        if (itemsWithIndex.length === 0) {
          resetBtn.style.display = "none";
        } else {
          resetBtn.style.display = "";
        }
      }

      if (listEl) {
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

            const textContainer = document.createElement("div");
            textContainer.style.display = "flex";
            textContainer.style.alignItems = "center";
            textContainer.style.gap = "8px";
            textContainer.style.flex = "1";
            textContainer.style.overflow = "hidden";
            textContainer.style.marginRight = "6px";

            const badge = document.createElement("span");
            badge.textContent = `#${displayIndex + 1}`;
            badge.style.color = "#888";
            badge.style.display = "inline-block";
            badge.style.minWidth = "24px";
            badge.style.fontWeight = "600";
            badge.style.flexShrink = "0";
            badge.style.flexGrow = "0";
            badge.style.cursor = "pointer";
            badge.style.whiteSpace = "nowrap";
            badge.style.marginRight = "0";

            const span = document.createElement("span");
            span.textContent = sel;
            span.title = sel;
            span.style.flex = "1";
            span.style.minWidth = "0";
            span.style.overflow = "hidden";
            span.style.textOverflow = "ellipsis";
            span.style.whiteSpace = "nowrap";
            span.style.marginLeft = "0";

            textContainer.appendChild(badge);
            textContainer.appendChild(span);

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

            badge.addEventListener("click", startEditing);
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
                    triggerTabRefresh();
                  });
                } else {
                  chrome.storage.local.set({ [hostname]: currentItems }, () => {
                    resetEditingState();
                    triggerTabRefresh();
                  });
                }
              });
            });

            btnGroup.appendChild(editBtn);
            btnGroup.appendChild(delBtn);

            li.appendChild(textContainer);
            li.appendChild(btnGroup);
            listEl.appendChild(li);
          });
        }
      }
    });
  }

  async function resetEditingState() {
    editingIndex = null;
    if (customInput) customInput.value = "";
    if (addCustomBtn) {
      addCustomBtn.innerHTML = "➕";
      addCustomBtn.title = await getMsg("addBtnTooltip", "Add Custom Selector");
      addCustomBtn.className = "add-icon-btn";
    }
    cancelEditBtn.style.display = "none";
    if (editHint) {
      editHint.textContent = await getMsg(
        "editHintText",
        "💡 Click ✏️ on items below to edit"
      );
    }
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
    if (!customInput) return;
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
        triggerTabRefresh(); // สั่งอัปเดตหน้าเว็บทันทีหลังบันทึก
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
        triggerTabRefresh(); // สั่งอัปเดตหน้าเว็บทันทีหลังรีเซ็ต
      });
    });
  }
});
