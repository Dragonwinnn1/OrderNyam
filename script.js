/*************************************************
 * CONFIG
 *************************************************/
// GANTI INI dengan URL Web App Apps Script kamu
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGH8KuOqzdyy2sfqph3qsPnfiKmx9FNPxyuUq27DU2CZ2ZREhzQH3Eg-HjMklty8oCaQ/exec";

/*************************************************
 * STATE
 *************************************************/
let WA_ADMIN = "";
let MENU_ITEMS = [];
let CART = {}; // { title: qty }

/*************************************************
 * DOM
 *************************************************/
const menuList   = document.getElementById("menuList");
const cartBox    = document.getElementById("cartBox");
const menuInfo   = document.getElementById("menuInfo");
const btnReload  = document.getElementById("btnReload");
const btnOrder   = document.getElementById("btnOrder");
const statusText = document.getElementById("statusText");
const nameInput  = document.getElementById("nameInput");

/*************************************************
 * HELPERS
 *************************************************/
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(msg) {
  statusText.textContent = msg || "";
}

function parseMenuLines(menuLines) {
  // gabungkan semua baris jadi 1 text besar
  const rawText = (menuLines || []).join(" ").trim();
  if (!rawText) return [];

  // pecah berdasarkan bintang
  let items = rawText.split("*").map(x => x.trim()).filter(Boolean);

  // fallback kalau tidak ada bintang
  if (items.length <= 1) {
    items = rawText.split(",").map(x => x.trim()).filter(Boolean);
  }

  // buang item terlalu pendek
  items = items.filter(x => x.length >= 3);

  // hapus duplikat
  items = [...new Set(items)];

  return items;
}

function cartToArray() {
  const arr = [];
  Object.keys(CART).forEach(title => {
    const qty = Number(CART[title] || 0);
    if (qty > 0) arr.push({ title, qty });
  });
  return arr;
}

function buildWhatsAppText(name, items) {
  let text = `*PESANAN BARU*\n\n`;
  text += `Nama: ${name}\n\n`;
  text += `Pesanan:\n`;
  items.forEach(it => {
    text += `- ${it.qty}x ${it.title}\n`;
  });
  text += `\nTerima kasih 🙏`;
  return text;
}

/*************************************************
 * API
 *************************************************/
async function apiPost(payload) {
  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

/*************************************************
 * RENDER MENU
 *************************************************/
function renderMenu(menuItems) {
  menuList.innerHTML = "";

  if (!menuItems.length) {
    menuList.innerHTML = `<div class="muted">Menu kosong.</div>`;
    return;
  }

  menuItems.forEach((title) => {
    const div = document.createElement("div");
    div.className = "menu-item";

    div.innerHTML = `
      <div class="menu-title">${escapeHtml(title)}</div>
      <button class="btn-add" type="button">+</button>
    `;

    div.querySelector(".btn-add").addEventListener("click", () => {
      addToCart(title);
    });

    menuList.appendChild(div);
  });
}

/*************************************************
 * CART
 *************************************************/
function addToCart(title) {
  CART[title] = (Number(CART[title] || 0) + 1);
  renderCart();
}

function incQty(title) {
  CART[title] = (Number(CART[title] || 0) + 1);
  renderCart();
}

function decQty(title) {
  CART[title] = (Number(CART[title] || 0) - 1);
  if (CART[title] <= 0) delete CART[title];
  renderCart();
}

function renderCart() {
  const items = cartToArray();

  if (!items.length) {
    cartBox.innerHTML = `<div class="muted">Keranjang masih kosong.</div>`;
    return;
  }

  cartBox.innerHTML = "";

  items.forEach(it => {
    const div = document.createElement("div");
    div.className = "cart-item";

    div.innerHTML = `
      <div class="cart-left">
        <div class="cart-title">${escapeHtml(it.title)}</div>
        <div class="cart-qty">
          <button class="qty-btn" type="button">-</button>
          <div class="qty-num">${it.qty}</div>
          <button class="qty-btn" type="button">+</button>
        </div>
      </div>
    `;

    const btnMinus = div.querySelectorAll(".qty-btn")[0];
    const btnPlus  = div.querySelectorAll(".qty-btn")[1];

    btnMinus.addEventListener("click", () => decQty(it.title));
    btnPlus.addEventListener("click", () => incQty(it.title));

    cartBox.appendChild(div);
  });
}

/*************************************************
 * LOAD MENU
 *************************************************/
async function loadMenu() {
  setStatus("Memuat menu...");

  try {
    const res = await apiPost({ action: "getMenu" });

    if (!res.ok) {
      setStatus("Gagal load menu: " + (res.message || ""));
      return;
    }

    WA_ADMIN = String(res.waAdmin || "").trim();
    MENU_ITEMS = parseMenuLines(res.menuLines || []);

    menuInfo.textContent = `Menu tersedia: ${MENU_ITEMS.length} item`;
    renderMenu(MENU_ITEMS);

    setStatus("Menu berhasil dimuat.");
  } catch (err) {
    setStatus("Error: " + String(err));
  }
}

/*************************************************
 * CREATE ORDER
 *************************************************/
async function submitOrder() {
  const name = String(nameInput.value || "").trim();
  const items = cartToArray();

  if (!name) {
    setStatus("Nama wajib diisi.");
    return;
  }
  if (!items.length) {
    setStatus("Keranjang masih kosong.");
    return;
  }

  btnOrder.disabled = true;
  btnOrder.textContent = "Mengirim...";
  setStatus("Menyimpan pesanan...");

  try {
    // 1) simpan ke sheets
    const res = await apiPost({
      action: "createOrder",
      name,
      items
    });

    if (!res.ok) {
      setStatus("Gagal: " + (res.message || ""));
      return;
    }

    // 2) redirect WA admin
    if (!WA_ADMIN) {
      setStatus("Pesanan tersimpan, tapi WA_ADMIN belum diisi di Google Sheets.");
      return;
    }

    const waText = buildWhatsAppText(name, items);
    const url = `https://wa.me/${WA_ADMIN}?text=${encodeURIComponent(waText)}`;

    // reset cart
    CART = {};
    renderCart();

    setStatus("Pesanan tersimpan. Membuka WhatsApp...");

    window.open(url, "_blank");

  } catch (err) {
    setStatus("Error: " + String(err));
  } finally {
    btnOrder.disabled = false;
    btnOrder.textContent = "Pesan Sekarang";
  }
}

/*************************************************
 * EVENTS
 *************************************************/
btnReload.addEventListener("click", loadMenu);
btnOrder.addEventListener("click", submitOrder);

/*************************************************
 * INIT
 *************************************************/
renderCart();
loadMenu();
