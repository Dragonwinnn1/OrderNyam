/*************************************************
 * CONFIG
 *************************************************/
const API_URL = "https://script.google.com/macros/s/AKfycbyGH8KuOqzdyy2sfqph3qsPnfiKmx9FNPxyuUq27DU2CZ2ZREhzQH3Eg-HjMklty8oCaQ/exec";

/*************************************************
 * STATE
 *************************************************/
let MENU_LINES = [];
let WA_ADMIN = "";
let CART = {}; // { title: qty }

/*************************************************
 * ELEMENTS
 *************************************************/
const menuSubtitle = document.getElementById("menuSubtitle");
const btnReload = document.getElementById("btnReload");

const menuList = document.getElementById("menuList");
const cartList = document.getElementById("cartList");

const inpName = document.getElementById("inpName");

const btnOrder = document.getElementById("btnOrder");
const btnWA = document.getElementById("btnWA");
const statusBox = document.getElementById("statusBox");

/*************************************************
 * HELPERS
 *************************************************/
function setStatus(msg, isError=false){
  statusBox.textContent = msg || "";
  statusBox.style.color = isError ? "#ffb3c0" : "";
}

function escapeHTML(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function normalizePhone(phone){
  phone = String(phone || "").trim();
  phone = phone.replaceAll(" ", "").replaceAll("-", "");
  if (phone.startsWith("08")) phone = "62" + phone.slice(1);
  if (phone.startsWith("+62")) phone = "62" + phone.slice(3);
  return phone;
}

// Detect kategori dari baris
function isCategoryLine(line){
  const up = line.toUpperCase();

  if (line.includes("🍛") || line.includes("🥤")) return true;
  if (up.includes("MINUMAN")) return true;
  if (up.includes("MAKANAN")) return true;
  if (up.includes("PEYEK")) return true;
  if (up.includes("TOPPING")) return true;
  if (up.startsWith("MENU ")) return true;
  if (up.includes("MENYEDIAKAN")) return true;

  // tanggal
  if (up.includes("FEBRUARI") || up.includes("JANUARI") || up.includes("MARET") || up.includes("APRIL") || up.includes("MEI") || up.includes("JUNI") || up.includes("JULI") || up.includes("AGUSTUS") || up.includes("SEPTEMBER") || up.includes("OKTOBER") || up.includes("NOVEMBER") || up.includes("DESEMBER")) return true;

  // kalau cuma angka tanggal
  if (/^\d{1,2}\s/.test(up)) return true;

  return false;
}

function buildWAMessage(){
  const name = inpName.value.trim();

  const items = Object.keys(CART).map(title => ({
    title,
    qty: CART[title]
  })).filter(x => x.qty > 0);

  let text = `*PESANAN BARU*\n\n`;
  text += `Nama: ${name}\n\n`;
  text += `*Pesanan:*\n`;

  items.forEach(it => {
    text += `- ${it.qty}x ${it.title}\n`;
  });

  text += `\nTerima kasih 🙏`;

  return encodeURIComponent(text);
}

function renderCart(){
  const items = Object.keys(CART)
    .map(title => ({ title, qty: CART[title] }))
    .filter(x => x.qty > 0);

  if (!items.length){
    cartList.classList.add("empty");
    cartList.innerHTML = "Keranjang masih kosong.";
    return;
  }

  cartList.classList.remove("empty");
  cartList.innerHTML = items.map(it => {
    return `
      <div class="cart-item">
        <div class="cart-title">${escapeHTML(it.title)}</div>
        <div class="actions">
          <button class="btn secondary small" onclick="cartMinus('${escapeHTML(it.title)}')">-</button>
          <div class="qty">${it.qty}</div>
          <button class="btn secondary small" onclick="cartPlus('${escapeHTML(it.title)}')">+</button>
          <button class="btn danger small" onclick="cartRemove('${escapeHTML(it.title)}')">Hapus</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderMenu(){
  menuList.innerHTML = "";

  MENU_LINES.forEach((line) => {
    // kategori / judul
    if (isCategoryLine(line)){
      const div = document.createElement("div");
      div.className = "menu-item";
      div.innerHTML = `<div class="menu-title"><b>${escapeHTML(line)}</b></div>`;
      menuList.appendChild(div);
      return;
    }

    // item normal
    const qty = CART[line] || 0;

    const div = document.createElement("div");
    div.className = "menu-item";
    div.innerHTML = `
      <div class="menu-title">${escapeHTML(line)}</div>
      <div class="actions">
        <button class="btn secondary small" onclick="menuMinus('${escapeHTML(line)}')">-</button>
        <div class="qty">${qty}</div>
        <button class="btn secondary small" onclick="menuPlus('${escapeHTML(line)}')">+</button>
      </div>
    `;
    menuList.appendChild(div);
  });
}

/*************************************************
 * CART ACTIONS (global for onclick)
 *************************************************/
window.menuPlus = function(title){
  title = String(title);
  CART[title] = (CART[title] || 0) + 1;
  renderMenu();
  renderCart();
};

window.menuMinus = function(title){
  title = String(title);
  CART[title] = Math.max(0, (CART[title] || 0) - 1);
  if (CART[title] === 0) delete CART[title];
  renderMenu();
  renderCart();
};

window.cartPlus = window.menuPlus;
window.cartMinus = window.menuMinus;

window.cartRemove = function(title){
  title = String(title);
  delete CART[title];
  renderMenu();
  renderCart();
};

/*************************************************
 * API
 *************************************************/
async function api(action, payload={}){
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });
  return await res.json();
}

async function loadMenu(){
  setStatus("Memuat menu...");
  btnWA.classList.add("hidden");
  btnWA.href = "#";

  const data = await api("getMenu");

  if (!data.ok){
    setStatus("Gagal load menu: " + data.message, true);
    return;
  }

  MENU_LINES = (data.menuLines || []).filter(x => String(x || "").trim());
  WA_ADMIN = normalizePhone(data.waAdmin || "");

  menuSubtitle.textContent = `Menu tersedia: ${MENU_LINES.length} baris`;

  renderMenu();
  renderCart();

  setStatus("Menu berhasil dimuat.");
}

/*************************************************
 * ORDER
 *************************************************/
btnOrder.addEventListener("click", async () => {
  try {
    setStatus("");

    const name = inpName.value.trim();
    if (!name) return setStatus("Nama wajib diisi.", true);

    const items = Object.keys(CART)
      .map(title => ({ title, qty: CART[title] }))
      .filter(x => x.qty > 0);

    if (!items.length) return setStatus("Keranjang masih kosong.", true);

    btnOrder.disabled = true;
    btnOrder.textContent = "Mengirim...";

    // Simpan ke sheets
    const save = await api("createOrder", {
      name,
      items,
      userAgent: navigator.userAgent
    });

    if (!save.ok){
      btnOrder.disabled = false;
      btnOrder.textContent = "Pesan Sekarang";
      return setStatus("Gagal simpan pesanan: " + save.message, true);
    }

    // WA admin
    if (WA_ADMIN){
      const msg = buildWAMessage();
      btnWA.href = `https://wa.me/${WA_ADMIN}?text=${msg}`;
      btnWA.classList.remove("hidden");
    } else {
      btnWA.classList.add("hidden");
    }

    setStatus("Pesanan berhasil disimpan. Klik tombol WhatsApp untuk mengirim ke admin.");

    // Reset cart
    CART = {};
    renderMenu();
    renderCart();

    btnOrder.disabled = false;
    btnOrder.textContent = "Pesan Sekarang";
  } catch (err){
    btnOrder.disabled = false;
    btnOrder.textContent = "Pesan Sekarang";
    setStatus("Error: " + err.message, true);
  }
});

btnReload.addEventListener("click", loadMenu);

/*************************************************
 * INIT
 *************************************************/
loadMenu();
