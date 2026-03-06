const DB_NAME = "bnd_db";
const DB_VER = 1;
const STORE = "items";

let db;
let allItems = [];
let editingId = null;
let deferredPrompt = null;

const els = {
  q: document.getElementById("q"),
  filterRate: document.getElementById("filterRate"),
  tbody: document.getElementById("tbody"),
  cards: document.getElementById("cards"),
  count: document.getElementById("count"),

  addNewTop: document.getElementById("addNewTop"),
  fabAdd: document.getElementById("fabAdd"),
  clearAll: document.getElementById("clearAll"),

  xlsxFile: document.getElementById("xlsxFile"),
  exportJson: document.getElementById("exportJson"),
  jsonFile: document.getElementById("jsonFile"),

  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  closeModal: document.getElementById("closeModal"),
  fName: document.getElementById("fName"),
  fCode: document.getElementById("fCode"),
  fRate: document.getElementById("fRate"),
  fPrice: document.getElementById("fPrice"),
  saveItem: document.getElementById("saveItem"),
  deleteItem: document.getElementById("deleteItem"),
  msg: document.getElementById("msg"),

  installBtn: document.getElementById("installBtn"),
};

function norm(s){
  return (s ?? "").toString().trim().replace(/\s+/g, " ");
}

function normCode(s){
  return norm(s).replace(/[^\d]/g, "");
}

function parsePrice(s){
  const t = norm(s).replace(/,/g, ".");
  if (!t) return "";
  const n = Number(t);
  if (Number.isFinite(n) && n >= 0) return n;
  return "";
}

function escapeHtml(str){
  return (str ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);

    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      const store = db.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("name", "name", { unique: false });
      store.createIndex("code", "code", { unique: false });
      store.createIndex("rate", "rate", { unique: false });
    };

    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

function txStore(mode = "readonly"){
  return db.transaction(STORE, mode).objectStore(STORE);
}

function getAll(){
  return new Promise((resolve, reject)=>{
    const req = txStore().getAll();
    req.onsuccess = ()=> resolve(req.result || []);
    req.onerror = ()=> reject(req.error);
  });
}

function putItem(item){
  return new Promise((resolve, reject)=>{
    const req = txStore("readwrite").put(item);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

function deleteById(id){
  return new Promise((resolve, reject)=>{
    const req = txStore("readwrite").delete(id);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

function clearAllStore(){
  return new Promise((resolve, reject)=>{
    const req = txStore("readwrite").clear();
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

function render(){
  const q = norm(els.q.value).toLowerCase();
  const rate = norm(els.filterRate.value);

  const filtered = allItems.filter(it=>{
    const okRate = !rate || it.rate === rate;
    const nameHit = !q || (it.name || "").toLowerCase().includes(q);
    const codeHit = !q || (it.code || "").includes(q);
    return okRate && (nameHit || codeHit);
  });

  els.count.textContent = filtered.length;

  els.cards.innerHTML = filtered.map(it=>{
    const price = (it.price === "" || it.price === null || it.price === undefined) ? "-" : it.price;
    return `
      <article class="itemCard">
        <div class="itemTop">
          <div>
            <div class="itemName">${escapeHtml(it.name || "")}</div>
            <div class="itemCode">البند: ${escapeHtml(it.code || "")}</div>
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
            <div class="metaVal">${escapeHtml(it.code || "")}</div>
          </div>
        </div>

        <div class="itemActions">
          <button class="smallBtn" data-edit="${it.id}">تعديل</button>
          <button class="smallBtn danger" data-del="${it.id}">حذف</button>
        </div>
      </article>
    `;
  }).join("");

  els.tbody.innerHTML = filtered.map(it=>{
    const price = (it.price === "" || it.price === null || it.price === undefined) ? "" : String(it.price);
    return `
      <tr>
        <td>${escapeHtml(it.name || "")}</td>
        <td>${escapeHtml(it.code || "")}</td>
        <td>${escapeHtml(it.rate || "")}</td>
        <td>${escapeHtml(price)}</td>
        <td>
          <button class="smallBtn" data-edit="${it.id}">تعديل</button>
          <button class="smallBtn danger" data-del="${it.id}">حذف</button>
        </td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.addEventListener("click", ()=> openEdit(btn.dataset.edit));
  });

  document.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=> onDelete(btn.dataset.del));
  });
}

function showModal(show){
  els.modal.hidden = !show;
  document.body.style.overflow = show ? "hidden" : "";
  if (show) {
    setTimeout(()=> els.fName.focus(), 60);
  }
}

function resetForm(){
  editingId = null;
  els.modalTitle.textContent = "إضافة صنف";
  els.fName.value = "";
  els.fCode.value = "";
  els.fRate.value = "";
  els.fPrice.value = "";
  els.msg.hidden = true;
  els.deleteItem.hidden = true;
}

function openAdd(){
  resetForm();
  showModal(true);
}

function openEdit(id){
  const it = allItems.find(x => x.id === id);
  if (!it) return;

  editingId = id;
  els.modalTitle.textContent = "تعديل صنف";
  els.fName.value = it.name || "";
  els.fCode.value = it.code || "";
  els.fRate.value = it.rate || "";
  els.fPrice.value = (it.price === "" || it.price === null || it.price === undefined) ? "" : String(it.price);
  els.msg.hidden = true;
  els.deleteItem.hidden = false;
  showModal(true);
}

function toast(msg){
  els.msg.textContent = msg;
  els.msg.hidden = false;
}

async function onSave(){
  const name = norm(els.fName.value);
  const code = normCode(els.fCode.value);
  const rate = norm(els.fRate.value);
  const price = parsePrice(els.fPrice.value);

  if (!name) return toast("اكتب اسم الصنف.");
  if (!code) return toast("اكتب رقم البند.");
  if (rate && !["5%", "10%", "25%"].includes(rate)) return toast("اختر فئة صحيحة.");
  if (els.fPrice.value && price === "") return toast("السعر يجب أن يكون رقمًا صحيحًا.");

  const item = {
    id: editingId || crypto.randomUUID(),
    name,
    code,
    rate: rate || "",
    price
  };

  await putItem(item);
  showModal(false);
  await reload();
}

async function onDelete(id){
  const it = allItems.find(x => x.id === id);
  if (!it) return;
  const ok = confirm(`حذف الصنف: ${it.name} ؟`);
  if (!ok) return;
  await deleteById(id);
  await reload();
}

async function onDeleteFromModal(){
  if (!editingId) return;
  const ok = confirm("هل تريد حذف هذا الصنف؟");
  if (!ok) return;
  await deleteById(editingId);
  showModal(false);
  await reload();
}

async function reload(){
  allItems = await getAll();
  allItems.sort((a,b)=>{
    const byName = (a.name || "").localeCompare((b.name || ""), "ar");
    if (byName !== 0) return byName;
    return (a.code || "").localeCompare((b.code || ""));
  });
  render();
}

function bestHeaderMatch(headers, wanted){
  const h = headers.map(x => norm(x).toLowerCase());
  const w = wanted.map(x => x.toLowerCase());

  for (let i = 0; i < h.length; i++){
    for (const k of w){
      if (h[i] === k) return i;
    }
  }

  for (let i = 0; i < h.length; i++){
    for (const k of w){
      if (h[i].includes(k)) return i;
    }
  }
  return -1;
}

async function importXLSX(file){
  if (!file) return;

  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (!rows.length) return alert("الملف فارغ.");

  const headers = rows[0] || [];
  const idxName = bestHeaderMatch(headers, ["الصنف","اسم الصنف","name"]);
  const idxCode = bestHeaderMatch(headers, ["البند","رقم البند","code","hs"]);
  const idxRate = bestHeaderMatch(headers, ["الفئة","rate"]);
  const idxPrice = bestHeaderMatch(headers, ["السعر (usd)","السعر","price","value"]);

  if (idxName < 0 || idxCode < 0){
    return alert("لم أجد عمودي الصنف والبند.");
  }

  let count = 0;

  for (let i = 1; i < rows.length; i++){
    const row = rows[i];
    const name = norm(row[idxName]);
    const code = normCode(row[idxCode]);
    if (!name || !code) continue;

    const rate = idxRate >= 0 ? norm(row[idxRate]) : "";
    const price = idxPrice >= 0 ? parsePrice(row[idxPrice]) : "";

    await putItem({
      id: crypto.randomUUID(),
      name,
      code,
      rate: ["5%","10%","25%"].includes(rate) ? rate : "",
      price
    });

    count++;
  }

  alert(`تم استيراد ${count} صنف`);
  await reload();
}

function download(filename, text, mime = "application/json"){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportJSON(){
  const data = await getAll();
  download(
    `backup_items_${Date.now()}.json`,
    JSON.stringify({ exportedAt: new Date().toISOString(), items: data }, null, 2)
  );
}

async function importJSON(file){
  if (!file) return;
  const text = await file.text();

  let payload;
  try{
    payload = JSON.parse(text);
  }catch{
    return alert("ملف JSON غير صالح.");
  }

  const items = payload.items || payload;
  if (!Array.isArray(items)) return alert("الملف لا يحتوي items.");

  let count = 0;
  for (const it of items){
    const name = norm(it.name || it["الصنف"]);
    const code = normCode(it.code || it["البند"]);
    if (!name || !code) continue;

    const rate = norm(it.rate || it["الفئة"]);
    const price = parsePrice(it.price ?? it["السعر (USD)"] ?? it["السعر"] ?? "");

    await putItem({
      id: crypto.randomUUID(),
      name,
      code,
      rate: ["5%","10%","25%"].includes(rate) ? rate : "",
      price
    });
    count++;
  }

  alert(`تم استيراد ${count} صنف`);
  await reload();
}

async function onClearAll(){
  const ok = confirm("هل تريد مسح كل البيانات من هذا الجهاز؟");
  if (!ok) return;
  await clearAllStore();
  await reload();
}

window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.hidden = false;
});

els.installBtn.addEventListener("click", async ()=>{
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.hidden = true;
});

if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

async function init(){
  db = await openDB();
  await reload();

  els.q.addEventListener("input", render);
  els.filterRate.addEventListener("change", render);

  els.addNewTop.addEventListener("click", openAdd);
  els.fabAdd.addEventListener("click", openAdd);
  els.closeModal.addEventListener("click", ()=> showModal(false));
  els.saveItem.addEventListener("click", onSave);
  els.deleteItem.addEventListener("click", onDeleteFromModal);
  els.clearAll.addEventListener("click", onClearAll);

  els.xlsxFile.addEventListener("change", (e)=> importXLSX(e.target.files[0]));
  els.exportJson.addEventListener("click", exportJSON);
  els.jsonFile.addEventListener("change", (e)=> importJSON(e.target.files[0]));

  els.modal.addEventListener("click", (e)=>{
    if (e.target === els.modal) showModal(false);
  });
}

init();
