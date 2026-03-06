/* مرجع البنود - بسام (GitHub Pages PWA)
   تخزين: IndexedDB
   ميزات: CRUD + بحث + استيراد Excel + تصدير/استيراد JSON
*/

const DB_NAME = "bnd_db";
const DB_VER = 1;
const STORE = "items";

let db;
let allItems = [];
let editingId = null;

const els = {
  q: document.getElementById("q"),
  filterRate: document.getElementById("filterRate"),
  tbody: document.getElementById("tbody"),
  count: document.getElementById("count"),

  addNew: document.getElementById("addNew"),
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
  return (s ?? "")
    .toString()
    .trim()
    .replace(/\s+/g, " ");
}

function normCode(s){
  return norm(s).replace(/[^\d]/g, "");
}

function parsePrice(s){
  const t = norm(s).replace(/,/g,".");
  if(!t) return "";
  const n = Number(t);
  if(Number.isFinite(n) && n >= 0) return n;
  return "";
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

function txStore(mode="readonly"){
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

function clearAll(){
  return new Promise((resolve, reject)=>{
    const req = txStore("readwrite").clear();
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

function render(){
  const q = norm(els.q.value);
  const r = norm(els.filterRate.value);

  const qLower = q.toLowerCase();
  const filtered = allItems.filter(it=>{
    const okRate = !r || it.rate === r;
    if(!q) return okRate;

    const nameHit = (it.name || "").toLowerCase().includes(qLower);
    const codeHit = (it.code || "").includes(q); // user may type digits
    return okRate && (nameHit || codeHit);
  });

  els.count.textContent = String(filtered.length);
  els.tbody.innerHTML = filtered.map(it=>{
    const price = (it.price === "" || it.price === null || it.price === undefined) ? "" : String(it.price);
    return `
      <tr>
        <td>${escapeHtml(it.name || "")}</td>
        <td><code>${escapeHtml(it.code || "")}</code></td>
        <td>${it.rate ? `<span class="pill">${escapeHtml(it.rate)}</span>` : ""}</td>
        <td>${escapeHtml(price)}</td>
        <td>
          <button class="smallBtn" data-edit="${it.id}">تعديل</button>
          <button class="smallBtn danger" data-del="${it.id}">حذف</button>
        </td>
      </tr>
    `;
  }).join("");

  // bind actions
  els.tbody.querySelectorAll("[data-edit]").forEach(b=>{
    b.addEventListener("click", ()=> openEdit(b.getAttribute("data-edit")));
  });
  els.tbody.querySelectorAll("[data-del]").forEach(b=>{
    b.addEventListener("click", ()=> onDelete(b.getAttribute("data-del")));
  });
}

function escapeHtml(str){
  return (str ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function showModal(show){
  els.modal.hidden = !show;
  els.msg.hidden = true;
  if(show) setTimeout(()=> els.fName.focus(), 10);
}

function resetForm(){
  editingId = null;
  els.modalTitle.textContent = "إضافة صنف";
  els.fName.value = "";
  els.fCode.value = "";
  els.fRate.value = "";
  els.fPrice.value = "";
  els.deleteItem.hidden = true;
}

function openAdd(){
  resetForm();
  showModal(true);
}

function openEdit(id){
  const it = allItems.find(x=> x.id === id);
  if(!it) return;
  editingId = id;
  els.modalTitle.textContent = "تعديل صنف";
  els.fName.value = it.name || "";
  els.fCode.value = it.code || "";
  els.fRate.value = it.rate || "";
  els.fPrice.value = (it.price === "" || it.price === null || it.price === undefined) ? "" : String(it.price);
  els.deleteItem.hidden = false;
  showModal(true);
}

async function onDelete(id){
  const it = allItems.find(x=> x.id === id);
  if(!it) return;
  const ok = confirm(`حذف الصنف: ${it.name} ؟`);
  if(!ok) return;
  await deleteById(id);
  await reload();
}

async function onDeleteFromModal(){
  if(!editingId) return;
  await deleteById(editingId);
  showModal(false);
  await reload();
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

  if(!name) return toast("اكتب اسم الصنف.");
  if(!code) return toast("اكتب رقم البند (أرقام فقط).");
  if(rate && !["5%","10%","25%"].includes(rate)) return toast("الفئة غير صحيحة.");
  if(els.fPrice.value && price === "") return toast("السعر لازم يكون رقم صحيح (مثال: 120).");

  const item = {
    id: editingId || crypto.randomUUID(),
    name, code, rate: rate || "", price
  };

  await putItem(item);
  showModal(false);
  await reload();
}

async function reload(){
  allItems = await getAll();
  // ترتيب: بالاسم ثم البند
  allItems.sort((a,b)=>{
    const an = (a.name||"").localeCompare(b.name||"", "ar");
    if(an !== 0) return an;
    return (a.code||"").localeCompare(b.code||"");
  });
  render();
}

function bestHeaderMatch(headers, wanted){
  const h = headers.map(x=> norm(x).toLowerCase());
  const w = wanted.map(x=> x.toLowerCase());
  for(let i=0;i<h.length;i++){
    for(const k of w){
      if(h[i] === k) return i;
    }
  }
  // contains match
  for(let i=0;i<h.length;i++){
    for(const k of w){
      if(h[i].includes(k)) return i;
    }
  }
  return -1;
}

async function importXLSX(file){
  if(!file) return;
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if(!rows.length) return alert("الملف فارغ.");
  const headers = rows[0] || [];
  const idxName = bestHeaderMatch(headers, ["الصنف","اسم الصنف","name"]);
  const idxCode = bestHeaderMatch(headers, ["البند","رقم البند","hs","code"]);
  const idxRate = bestHeaderMatch(headers, ["الفئة","rate"]);
  const idxPrice = bestHeaderMatch(headers, ["السعر (usd)","السعر","price","value"]);

  if(idxName < 0 || idxCode < 0){
    return alert("لم أجد أعمدة (الصنف) و(البند) في الصف الأول.");
  }

  let added = 0;
  for(let i=1;i<rows.length;i++){
    const row = rows[i];
    const name = norm(row[idxName]);
    const code = normCode(row[idxCode]);
    if(!name || !code) continue;

    const rate = idxRate >= 0 ? norm(row[idxRate]) : "";
    const price = idxPrice >= 0 ? parsePrice(row[idxPrice]) : "";

    const item = { id: crypto.randomUUID(), name, code, rate: ["5%","10%","25%"].includes(rate) ? rate : "", price };
    await putItem(item);
    added++;
  }
  alert(`تم الاستيراد: ${added} سطر`);
  await reload();
}

function download(filename, text, mime="application/json"){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportJSON(){
  const data = await getAll();
  const payload = {
    exportedAt: new Date().toISOString(),
    items: data
  };
  download(`backup_items_${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

async function importJSON(file){
  if(!file) return;
  const text = await file.text();
  let payload;
  try{
    payload = JSON.parse(text);
  }catch{
    return alert("ملف JSON غير صالح.");
  }
  const items = payload.items || payload;
  if(!Array.isArray(items)) return alert("JSON لا يحتوي قائمة items.");

  let added = 0;
  for(const it of items){
    const name = norm(it.name || it["الصنف"]);
    const code = normCode(it.code || it["البند"]);
    if(!name || !code) continue;

    const rate = norm(it.rate || it["الفئة"]);
    const price = parsePrice(it.price ?? it["السعر (USD)"] ?? it["السعر"] ?? "");

    await putItem({
      id: crypto.randomUUID(),
      name, code,
      rate: ["5%","10%","25%"].includes(rate) ? rate : "",
      price
    });
    added++;
  }
  alert(`تم استيراد: ${added} صنف`);
  await reload();
}

async function onClearAll(){
  const ok = confirm("متأكد تريد مسح كل البيانات من هذا الجهاز؟");
  if(!ok) return;
  await clearAll();
  await reload();
}

// PWA install
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.hidden = false;
});
els.installBtn.addEventListener("click", async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.hidden = true;
});

// Service worker
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

async function init(){
  db = await openDB();
  await reload();

  els.q.addEventListener("input", render);
  els.filterRate.addEventListener("change", render);
  els.addNew.addEventListener("click", openAdd);
  els.closeModal.addEventListener("click", ()=> showModal(false));
  els.saveItem.addEventListener("click", onSave);
  els.deleteItem.addEventListener("click", onDeleteFromModal);
  els.clearAll.addEventListener("click", onClearAll);

  els.xlsxFile.addEventListener("change", (e)=> importXLSX(e.target.files[0]));
  els.exportJson.addEventListener("click", exportJSON);
  els.jsonFile.addEventListener("change", (e)=> importJSON(e.target.files[0]));

  // close modal on background click
  els.modal.addEventListener("click", (e)=>{
    if(e.target === els.modal) showModal(false);
  });
}

init();
