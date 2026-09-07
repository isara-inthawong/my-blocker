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
  const addCustomBtn = document.getElementById("addCustomBtn");
  const customInput = document.getElementById("customInput");
  const editHint = document.getElementById("editHint");
  const listEl = document.getElementById("hiddenList");

  // อ้างอิง Element ปุ่มเปิด/ปิด Auto Pick จากไฟล์ popup.html ที่มีอยู่แล้ว
  const autoStatusText = document.getElementById("autoStatusText");
  const toggleAutoBtn = document.getElementById("toggleAutoBtn");

  let editingIndex = null;
  let originalEditValue = ""; // ตัวแปรเก็บค่าเดิมตอนเริ่มกดแก้ไข

  // ฟังก์ชันเช็คและจัดการสถานะ Disabled ของปุ่มเพิ่ม/บันทึก (+)
  function updateAddButtonState() {
    if (!customInput || !addCustomBtn) return;
    const val = customInput.value.trim();
    const isEmpty = val === "";

    // ถ้าอยู่ในโหมดแก้ไข และค่าในช่อง input ยังเหมือนเดิมเป๊ะกับตอนกดดินสอ ให้ disable ด้วย
    const isUnchangedDuringEdit =
      editingIndex !== null && val === originalEditValue;

    if (isEmpty || isUnchangedDuringEdit) {
      addCustomBtn.disabled = true;
      addCustomBtn.style.opacity = "0.5";
      addCustomBtn.style.cursor = "not-allowed";
    } else {
      addCustomBtn.disabled = false;
      addCustomBtn.style.opacity = "1";
      addCustomBtn.style.cursor = "pointer";
    }
  }

  // เรียกตรวจสอบสถานะปุ่มเริ่มต้น
  updateAddButtonState();

  // ดักจับการพิมพ์เพื่อเปิด/ปิดปุ่มแบบเรียลไทม์
  if (customInput) {
    customInput.addEventListener("input", updateAddButtonState);
  }

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

  // ฟังก์ชันกลางสำหรับทำความสะอาดและจัดระเบียบข้อมูล Selector
  function cleanItemsData(rawItems) {
    if (!Array.isArray(rawItems)) return [];

    let itemMap = new Map();
    rawItems.forEach((item, originalIndex) => {
      let sel = typeof item === "string" ? item : item?.selector || "";
      sel = sel.trim();
      if (!sel) return;

      let isAutoVal =
        typeof item === "object" && item !== null ? !!item.isAuto : false;
      let timestamp = item.timestamp || Date.now();

      let newItem = {
        selector: sel,
        timestamp,
        isAuto: isAutoVal,
        originalIndex
      };

      if (!itemMap.has(sel)) {
        itemMap.set(sel, newItem);
      } else {
        if (timestamp > itemMap.get(sel).timestamp) {
          itemMap.set(sel, newItem);
        }
      }
    });

    let cleanedArray = Array.from(itemMap.values());
    cleanedArray.sort((a, b) => b.timestamp - a.timestamp);

    return cleanedArray;
  }

  // ฟังก์ชันโหลดและเรนเดอร์รายการทั้งหมด (Single Source of Truth สำหรับการแสดงผล UI)
  async function loadAndRenderList() {
    if (!listEl) return;

    // เคลียร์ UI ทันทีที่เริ่มโหลดข้อมูลใหม่ ป้องกันการซ้ำซ้อน
    listEl.innerHTML = "";

    chrome.storage.local.get([hostname], async (result) => {
      let rawItems = result[hostname] || [];
      if (!Array.isArray(rawItems)) rawItems = [];

      let uniqueItems = cleanItemsData(rawItems);

      let isStorageDirty =
        uniqueItems.length !== rawItems.length ||
        uniqueItems.some((item, idx) => {
          let orig = rawItems[idx];
          let origSel = typeof orig === "string" ? orig : orig?.selector || "";
          let origAuto =
            typeof orig === "object" && orig !== null ? !!orig.isAuto : false;
          return origSel.trim() !== item.selector || origAuto !== item.isAuto;
        });

      if (isStorageDirty) {
        let storageToSave = uniqueItems.map(
          ({ selector, timestamp, isAuto }) => ({
            selector,
            timestamp,
            isAuto
          })
        );
        chrome.storage.local.set({ [hostname]: storageToSave });
        return; // ออกก่อนเพื่อให้ storage.onChanged ทำหน้าที่เรนเดอร์ต่อรอบถัดไป
      }

      let displayItems = uniqueItems;

      if (displayItems.length === 0) {
        const noItemsMsg = await getMsg("noItemsText", "No hidden items yet");
        listEl.innerHTML = `<li style="justify-content:center; color:#999; cursor:default; border:none; background:transparent;" data-i18n="noItemsText">${noItemsMsg}</li>`;
      } else {
        const editTooltip = await getMsg("editBtnTooltip", "Edit this item");
        const deleteTooltip = await getMsg(
          "deleteBtnTooltip",
          "Delete this item"
        );

        const fragment = document.createDocumentFragment();

        displayItems.forEach((itemObj, displayIndex) => {
          const sel = itemObj.selector;
          const isAuto = itemObj.isAuto;
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

          if (isAuto) {
            const autoBadge = document.createElement("span");
            autoBadge.textContent = "Auto";
            autoBadge.style.fontSize = "10px";
            autoBadge.style.background = "#e8f0fe";
            autoBadge.style.color = "#1a73e8";
            autoBadge.style.padding = "1px 4px";
            autoBadge.style.borderRadius = "3px";
            autoBadge.style.flexShrink = "0";
            textContainer.appendChild(autoBadge);
          }

          const startEditing = async () => {
            customInput.value = sel;
            originalEditValue = sel;
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
            updateAddButtonState();
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

            chrome.storage.local.get(
              [hostname, "disabled_auto_selectors"],
              (currentRes) => {
                let currentItems = currentRes[hostname] || [];
                let disabledSelectors =
                  currentRes.disabled_auto_selectors || [];

                const targetItem = currentItems[originalIndex];

                if (targetItem) {
                  let targetSelector =
                    typeof targetItem === "string"
                      ? targetItem
                      : targetItem.selector;

                  let isAutoVal =
                    typeof targetItem === "object"
                      ? !!targetItem.isAuto
                      : false;

                  // เช็กว่าถ้าเป็น isAuto หรือเนื้อหาตรงกับ DEFAULT_AUTO_PICK_RULES
                  let matchesDefaultRule = false;
                  if (
                    typeof DEFAULT_AUTO_PICK_RULES !== "undefined" &&
                    Array.isArray(DEFAULT_AUTO_PICK_RULES)
                  ) {
                    matchesDefaultRule =
                      DEFAULT_AUTO_PICK_RULES.includes(targetSelector);
                  }

                  // console.log("Delete Debug:", {
                  //   targetSelector,
                  //   isAutoVal,
                  //   matchesDefaultRule,
                  //   originalIndex,
                  //   DEFAULT_AUTO_PICK_RULES_Defined:
                  //     typeof DEFAULT_AUTO_PICK_RULES !== "undefined"
                  // });
                  if ((isAutoVal || matchesDefaultRule) && targetSelector) {
                    if (!disabledSelectors.includes(targetSelector)) {
                      disabledSelectors.push(targetSelector);
                    }
                  }
                }

                currentItems.splice(originalIndex, 1);

                const saveData = {
                  [hostname]: currentItems,
                  disabled_auto_selectors: disabledSelectors
                };

                if (currentItems.length === 0) {
                  chrome.storage.local.remove(hostname, () => {
                    chrome.storage.local.set(
                      { disabled_auto_selectors: disabledSelectors },
                      () => {
                        resetEditingState();
                        triggerTabRefresh();
                      }
                    );
                  });
                } else {
                  chrome.storage.local.set(saveData, () => {
                    resetEditingState();
                    triggerTabRefresh();
                  });
                }
              }
            );
          });

          btnGroup.appendChild(editBtn);
          btnGroup.appendChild(delBtn);

          li.appendChild(textContainer);
          li.appendChild(btnGroup);
          fragment.appendChild(li);
        });
        listEl.appendChild(fragment);
      }
    });
  }

  // ดักฟังการเปลี่ยนภาษาหรือข้อมูลใน storage ที่จุดนี้ที่เดียวเพื่ออัปเดต UI
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "local") {
      if (changes.preferred_lang) {
        await localizePopupElements();
        chrome.storage.local.get(["disabled_auto_hosts"], async (data) => {
          let disabledHosts = data.disabled_auto_hosts || [];
          await updateAutoUI(disabledHosts.includes(hostname));
        });
        await resetEditingState();
        loadAndRenderList();
      }
      if (changes[hostname]) {
        loadAndRenderList();
      }
    }
  });

  async function resetEditingState() {
    editingIndex = null;
    originalEditValue = "";
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
    updateAddButtonState();
  }

  cancelEditBtn.addEventListener("click", () => {
    resetEditingState();
  });

  // โหลดครั้งแรกตอนเปิด Popup
  loadAndRenderList();

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
    if (!customInput || addCustomBtn.disabled) return;
    const val = customInput.value.trim();
    if (!val) return;

    chrome.storage.local.get(
      [hostname, "disabled_auto_selectors"],
      (result) => {
        let hiddenList = result[hostname] || [];
        let disabledSelectors = result.disabled_auto_selectors || [];

        // ถ้ากำลังอยู่ในโหมดแก้ไข และตัวเดิมที่เป็น Auto ถูกแก้ไขเปลี่ยนแปลงไป
        if (
          editingIndex !== null &&
          editingIndex >= 0 &&
          editingIndex < hiddenList.length
        ) {
          const oldItem = hiddenList[editingIndex];
          if (
            oldItem &&
            (typeof oldItem === "object" ? oldItem.isAuto : false)
          ) {
            let oldSelector =
              typeof oldItem === "string" ? oldItem : oldItem.selector;

            // เช็กว่าถ้า selector เปลี่ยนไปจากเดิม ค่อยเอาตัวเก่าใส่ disabled_auto_selectors
            if (oldSelector && oldSelector !== val) {
              if (!disabledSelectors.includes(oldSelector)) {
                disabledSelectors.push(oldSelector);
              }
            }
          }
        }

        // ปลดล็อกทันทีถ้าค่าที่บันทึก/แก้ไขใหม่ไปตรงกับค่าที่เคยถูกบล็อกไว้
        disabledSelectors = disabledSelectors.filter((s) => s !== val);

        if (
          editingIndex !== null &&
          editingIndex >= 0 &&
          editingIndex < hiddenList.length
        ) {
          hiddenList[editingIndex] = {
            selector: val,
            timestamp: Date.now(),
            isAuto: false
          };
        } else {
          const existingIndex = hiddenList.findIndex((item) => {
            let sel = typeof item === "string" ? item : item?.selector || "";
            return sel.trim() === val;
          });

          if (existingIndex !== -1) {
            hiddenList[existingIndex] = {
              selector: val,
              timestamp: Date.now(),
              isAuto: false
            };
          } else {
            hiddenList.push({
              selector: val,
              timestamp: Date.now(),
              isAuto: false
            });
          }
        }

        let finalCleanList = cleanItemsData(hiddenList).map(
          ({ selector, timestamp, isAuto }) => ({ selector, timestamp, isAuto })
        );

        chrome.storage.local.set(
          {
            [hostname]: finalCleanList,
            disabled_auto_selectors: disabledSelectors
          },
          () => {
            resetEditingState();
            triggerTabRefresh();
          }
        );
      }
    );
  };

  if (addCustomBtn) {
    addCustomBtn.addEventListener("click", handleSaveOrAdd);
  }

  if (customInput) {
    customInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !addCustomBtn.disabled) {
        handleSaveOrAdd();
      }
    });
  }
});
