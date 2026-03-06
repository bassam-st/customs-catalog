const STORAGE_KEY = "customs_catalog_items_v4";

let items = [];
let editingId = null;
let deferredPrompt = null;

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindEls();
  loadItems();
  bindEvents();
  render();
  registerSW();
});

function bindEls() {
  els.q = document.getElementById("q");
  els.filterRate = document.getElementById("filterRate");
  els.count = document.getElementById("count");
  els.cards = document.getElementById("cards");
  els.tbody = document.getElementById("tbody");

  els.addNewTop = document.getElementById("addNewTop");
  els.fabAdd = document.getElementById("fabAdd");

  els.xlsxFile = document.getElementById("xlsxFile");
  els.exportJson = document.getElementById("exportJson");
  els.jsonFile = document.getElementById("jsonFile");
  els.clearAll = document.getElementById("clearAll");

  els.modal = document.getElementById("modal");
  els.modalTitle = document.getElementById("modalTitle");
  els.closeModal = document.getElementById("closeModal");
  els.fName = document.getElementById("fName");
  els.fCode = document.getElementById("fCode");
  els.fRate = document.getElementById("fRate");
  els.fPrice = document.getElementById("fPrice");
  els.saveItem = document.getElementById("saveItem");
  els.deleteItem = document.getElementById("deleteItem");
  els.msg = document.getElementById("msg");

  els.installBtn = document.getElementById("installBtn");
}

function bindEvents() {
  els.q?.addEventListener("input", render);
  els.filterRate?.addEventListener("change", render);

  els.addNewTop?.addEventListener("click", openAddModal);
  els.fabAdd?.addEventListener("click", openAddModal);

  els.closeModal?.addEventListener("click", closeModal);
  els.modal?.addEventListener("click", (e) => {
    if (e.target === els.modal) closeModal();
  });

  els.saveItem?.addEventListener("click", saveCurrentItem);
  els.deleteItem?.addEventListener("click", deleteCurrentItem);

  els.exportJson?.addEventListener("click", exportJSON);
  els.clearAll?.addEventListener("click", clearAllItems);

  els.jsonFile?.addEventListener("change", (e) => importJSON(e.target.files?.[0]));
  els.xlsxFile?.addEventListener("change", (e) => importXLSX(e.target.files?.[0]));

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (els.installBtn) els.installBtn.hidden = false;
  });

  els.installBtn?.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.hidden = true;
  });
}

function norm(v) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

function normCode(v) {
  return norm(v).replace(/[^\d]/g, "");
}

function parsePrice(v) {
  const s = norm(v).replace(/,/g, ".");
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : "";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items)) items = [];
  } catch {
    items = [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function render() {
  const q = norm(els.q?.value).toLowerCase();
  const rate = norm(els.filterRate?.value);

  const filtered = items.filter((it) => {
    const okRate = !rate || it.rate === rate;
    const nameHit = !q || (it.name || "").toLowerCase().includes(q);
    const codeHit = !q || (it.code || "").includes(q);
    return okRate && (nameHit || codeHit);
  });

  if (els.count) els.count.textContent = String(filtered.length);

  if (els.cards) {
    els.cards.innerHTML = filtered.map((it) => {
      const price = it.price === "" ? "-" : it.price;
      return `
        <article class="itemCard">
          <div class="itemTop">
            <div>
              <div class="itemName">${escapeHtml(it.name)}</div>
              <div class="itemCode">البند: ${escapeHtml(it.code)}</div>
            </div>
            ${it.rate ? `<span class="ratePill">${escapeHtml(it.rate)}</span>` : ""}
          </div>

          <div class="itemMeta">
            <div class="metaBox">
              <span class="metaLabel">السعر</span>
              <div class="metaVal">${escapeHtml(String(price))} USD</div>
            </div>
            <div class="metaBox">
              <span class="metaLabel">رقم البند</span>
              <div class="metaVal">${escapeHtml(it.code)}</div>
            </div>
          </div>

          <div class="itemActions">
            <button class="smallBtn" data-edit="${it.id}">تعديل</button>
            <button class="smallBtn danger" data-del="${it.id}">حذف</button>
          </div>
        </article>
      `;
    }).join("");
  }

  if (els.tbody) {
    els.tbody.innerHTML = filtered.map((it) => {
      const price = it.price === "" ? "" : it.price;
      return `
        <tr>
          <td>${escapeHtml(it.name)}</td>
          <td>${escapeHtml(it.code)}</td>
          <td>${escapeHtml(it.rate || "")}</td>
          <td>${escapeHtml(String(price))}</td>
          <td>
            <button class="smallBtn" data-edit="${it.id}">تعديل</button>
            <button class="smallBtn danger" data-del="${it.id}">حذف</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => openEditModal(btn.getAttribute("data-edit"));
  });

  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = () => deleteById(btn.getAttribute("data-del"));
  });
}

function showMsg(text) {
  if (!els.msg) return;
  els.msg.textContent = text;
  els.msg.hidden = false;
}

function hideMsg() {
  if (!els.msg) return;
  els.msg.hidden = true;
  els.msg.textContent = "";
}

function openAddModal() {
  editingId = null;
  if (els.modalTitle) els.modalTitle.textContent = "إضافة صنف";
  if (els.fName) els.fName.value = "";
  if (els.fCode) els.fCode.value = "";
  if (els.fRate) els.fRate.value = "";
  if (els.fPrice) els.fPrice.value = "";
  if (els.deleteItem) els.deleteItem.hidden = true;
  hideMsg();
  openModal();
}

function openEditModal(id) {
  const it = items.find((x) => x.id === id);
  if (!it) return;

  editingId = id;
  if (els.modalTitle) els.modalTitle.textContent = "تعديل صنف";
  if (els.fName) els.fName.value = it.name || "";
  if (els.fCode) els.fCode.value = it.code || "";
  if (els.fRate) els.fRate.value = it.rate || "";
  if (els.fPrice) els.fPrice.value = it.price === "" ? "" : String(it.price);
  if (els.deleteItem) els.deleteItem.hidden = false;
  hideMsg();
  openModal();
}

function openModal() {
  if (!els.modal) return;
  els.modal.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => els.fName?.focus(), 80);
}

function closeModal() {
  if (!els.modal) return;
  els.modal.hidden = true;
  document.body.style.overflow = "";
}

function saveCurrentItem() {
  const name = norm(els.fName?.value);
  const code = normCode(els.fCode?.value);
  const rate = norm(els.fRate?.value);
  const price = parsePrice(els.fPrice?.value);

  if (!name) return showMsg("اكتب اسم الصنف.");
  if (!code) return showMsg("اكتب رقم البند.");
  if (rate && !["5%", "10%", "25%"].includes(rate)) return showMsg("اختر الفئة.");
  if (els.fPrice?.value && price === "") return showMsg("السعر يجب أن يكون رقمًا صحيحًا.");

  const obj = {
    id: editingId || crypto.randomUUID(),
    name,
    code,
    rate: rate || "",
    price
  };

  const idx = items.findIndex((x) => x.id === obj.id);
  if (idx >= 0) {
    items[idx] = obj;
  } else {
    items.unshift(obj);
  }

  saveItems();
  closeModal();
  render();
}

function deleteCurrentItem() {
  if (!editingId) return;
  const ok = confirm("هل تريد حذف هذا الصنف؟");
  if (!ok) return;
  deleteById(editingId);
  closeModal();
}

function deleteById(id) {
  items = items.filter((x) => x.id !== id);
  saveItems();
  render();
}

function clearAllItems() {
  const ok = confirm("هل تريد مسح كل البيانات من هذا الجهاز؟");
  if (!ok) return;
  items = [];
  saveItems();
  render();
}

function exportJSON() {
  const payload = {
    exportedAt: new Date().toISOString(),
    items
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `customs-catalog-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importJSON(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : data.items;
    if (!Array.isArray(arr)) {
      alert("ملف JSON غير صالح.");
      return;
    }

    let count = 0;
    for (const it of arr) {
      const name = norm(it.name || it["الصنف"]);
      const code = normCode(it.code || it["البند"]);
      if (!name || !code) continue;

      const rate = norm(it.rate || it["الفئة"]);
      const price = parsePrice(it.price ?? it["السعر"] ?? it["السعر (USD)"] ?? "");

      items.unshift({
        id: crypto.randomUUID(),
        name,
        code,
        rate: ["5%", "10%", "25%"].includes(rate) ? rate : "",
        price
      });
      count++;
    }

    saveItems();
    render();
    alert(`تم استيراد ${count} صنف`);
  } catch {
    alert("فشل استيراد ملف JSON");
  }
}

async function importXLSX(file) {
  if (!file) return;
  if (typeof XLSX === "undefined") {
    alert("مكتبة Excel غير متوفرة.");
    return;
  }

  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (!rows.length) {
      alert("الملف فارغ.");
      return;
    }

    const headers = rows[0].map((x) => norm(x).toLowerCase());

    const findIndex = (names) => {
      for (let i = 0; i < headers.length; i++) {
        for (const n of names) {
          const v = n.toLowerCase();
          if (headers[i] === v || headers[i].includes(v)) return i;
        }
      }
      return -1;
    };

    const idxName = findIndex(["الصنف", "اسم الصنف", "name"]);
    const idxCode = findIndex(["البند", "رقم البند", "code", "hs"]);
    const idxRate = findIndex(["الفئة", "rate"]);
    const idxPrice = findIndex(["السعر", "السعر (usd)", "price", "value"]);

    if (idxName < 0 || idxCode < 0) {
      alert("لم أجد عمودي الصنف والبند.");
      return;
    }

    let count = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = norm(row[idxName]);
      const code = normCode(row[idxCode]);
      if (!name || !code) continue;

      const rate = idxRate >= 0 ? norm(row[idxRate]) : "";
      const price = idxPrice >= 0 ? parsePrice(row[idxPrice]) : "";

      items.unshift({
        id: crypto.randomUUID(),
        name,
        code,
        rate: ["5%", "10%", "25%"].includes(rate) ? rate : "",
        price
      });

      count++;
    }

    saveItems();
    render();
    alert(`تم استيراد ${count} صنف`);
  } catch {
    alert("فشل استيراد Excel");
  }
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js?v=4").catch(() => {});
}
