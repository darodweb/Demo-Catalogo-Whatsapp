// ============================================================
//  CONFIGURACIÓN — mantener sincronizado con index.js
// ============================================================
const CONFIG = {
  nombre:         "Mi Tienda Online",
  moneda:         "$",
  whatsappNumero: "3547604687",
  sheetId:        "17RHQZA7ri9J_ZeDD0F_IN53J5OwchQBBzw4ONJnkFsk",
  sheetName:      "Productos",
};

// ============================================================
//  ADICIONALES POR CATEGORÍA
//  La clave debe coincidir exactamente con el valor de la
//  columna "categoria" del Google Sheet.
//  Las categorías sin entrada aquí no muestran adicionales.
//
//  Ejemplo:
//  "Pizzas": [
//    { id: 'cheddar', nombre: 'Extra queso cheddar', precio: 150, emoji: '🧀' },
//    { id: 'jamon',   nombre: 'Extra jamón',          precio: 180, emoji: '🍖' },
//  ],
//  "Hamburguesas": [
//    { id: 'bacon',   nombre: 'Extra bacon',          precio: 200, emoji: '🥓' },
//    { id: 'doble',   nombre: 'Doble medallón',        precio: 350, emoji: '🍔' },
//  ],
// ============================================================
const EXTRAS_POR_CATEGORIA = {
  // Definir adicionales por categoría aquí
    "Hamburguesas": [
    { id: 'bacon',   nombre: 'Extra bacon',          precio: 200, emoji: '' },
    { id: 'doble',   nombre: 'Doble medallón',        precio: 350, emoji: '' },
  ],
};

// Devuelve los extras del producto actual ([] si la categoría no tiene)
function getExtras() {
  return (product && EXTRAS_POR_CATEGORIA[product.categoria]) || [];
}

// ============================================================

let product  = null;
let qty      = 1;
const extrasQty = {};

// ===== INIT =====

function init() {
  const params    = new URLSearchParams(window.location.search);
  const productId = parseInt(params.get("id"));

  if (!productId) { goBack(); return; }

  // Intentar leer desde sessionStorage (puesto por index.js al cargar)
  try {
    const stored = sessionStorage.getItem("tienda_products");
    if (stored) {
      const all = JSON.parse(stored);
      product = all.find(p => p.id === productId);
    }
  } catch {}

  if (product) {
    render();
  } else {
    fetchProduct(productId);
  }
}

async function fetchProduct(targetId) {
  if (CONFIG.sheetId === "TU_SHEET_ID_AQUI") {
    document.getElementById("navTitle").textContent = "Producto no encontrado";
    return;
  }

  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CONFIG.sheetName)}`;
  try {
    const res  = await fetch(url);
    const csv  = await res.text();
    const all  = parseCSV(csv);
    sessionStorage.setItem("tienda_products", JSON.stringify(all));
    product = all.find(p => p.id === targetId);
    if (product) render();
    else document.getElementById("navTitle").textContent = "No encontrado";
  } catch {
    document.getElementById("navTitle").textContent = "Error al cargar";
  }
}

// ===== CSV PARSER (igual que index.js) =====

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());
  const get = (row, name) => { const i = headers.indexOf(name); return i >= 0 ? (row[i] || "").trim() : ""; };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i]);
    if (!row.some(c => c.trim())) continue;
    const nombre = get(row, "nombre");
    if (!nombre) continue;
    const disponible = get(row, "disponible");
    out.push({
      id:          i,
      nombre,
      descripcion: get(row, "descripcion"),
      precio:      parseFloat(get(row, "precio").replace(/[^0-9.]/g, "")) || 0,
      categoria:   get(row, "categoria") || "General",
      emoji:       get(row, "emoji") || "📦",
      imagen:      get(row, "imagen"),
      badge:       get(row, "badge"),
      disponible:  disponible.toUpperCase() !== "FALSE",
    });
  }
  return out;
}

function parseLine(line) {
  const result = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ===== RENDER =====

function render() {
  document.title = `${product.nombre} — ${CONFIG.nombre}`;
  document.getElementById("navTitle").textContent = product.nombre;

  // Hero
  const hero = document.getElementById("productHero");
  if (product.imagen) {
    hero.innerHTML = `<img src="${product.imagen}" alt="${product.nombre}">`;
  } else {
    hero.innerHTML = `<div class="product-hero-emoji">${product.emoji}</div>`;
  }

  // Badge
  document.getElementById("productBadgeWrap").innerHTML = product.badge
    ? `<span class="product-badge" style="margin-bottom:0.8rem;display:inline-block">${product.badge}</span>`
    : "";

  // Nombre y descripción
  document.getElementById("productName").textContent = product.nombre;
  document.getElementById("productDesc").textContent = product.descripcion || "";

  // Precio
  renderPrice();

  // Adicionales
  renderExtras();

  // Barra inferior
  renderBottomBar();

  // Contador de caracteres
  document.getElementById("aclaraciones").addEventListener("input", function () {
    document.getElementById("charCount").textContent = `${this.value.length} / 200`;
  });
}

function renderPrice() {
  const el = document.getElementById("priceSection");

  if (!product.disponible) {
    el.innerHTML = `<p class="price-consultar-text" style="font-style:normal;color:var(--text-3)">Este producto no está disponible.</p>`;
    return;
  }
  if (!product.precio) {
    el.innerHTML = `
      <p class="price-label">Precio</p>`;
    return;
  }
  el.innerHTML = `
    <p class="price-label">Precio</p>
    <p class="price-value">${CONFIG.moneda}&nbsp;${product.precio.toLocaleString("es-AR")}</p>`;
}

// ===== ADICIONALES =====

function renderExtras() {
  if (!product.precio) return;
  const extras = getExtras();
  if (!extras.length) return;

  extras.forEach(e => { extrasQty[e.id] = 0; });

  const section = document.getElementById("extrasSection");
  const list    = document.getElementById("extrasList");

  list.innerHTML = extras.map(e => `
    <div class="extra-item">
      <div class="extra-info">
        <div class="extra-name">${e.emoji ? e.emoji + " " : ""}${e.nombre}</div>
        <div class="extra-price">+ ${CONFIG.moneda} ${e.precio.toLocaleString("es-AR")}</div>
      </div>
      <div class="extra-control">
        <button class="extra-btn" onclick="changeExtra('${e.id}', -1)">−</button>
        <span class="extra-qty" id="extqty-${e.id}">0</span>
        <button class="extra-btn plus" onclick="changeExtra('${e.id}', 1)">+</button>
      </div>
    </div>`).join("");

  section.style.display = "block";
}

function changeExtra(id, delta) {
  extrasQty[id] = Math.max(0, (extrasQty[id] || 0) + delta);
  document.getElementById(`extqty-${id}`).textContent = extrasQty[id];
  renderBottomBar();
}

// ===== BARRA INFERIOR =====

function renderBottomBar() {
  const bar = document.getElementById("bottomBar");

  if (!product.disponible) {
    bar.innerHTML = `<button class="agregar-btn" disabled style="justify-content:center">Producto agotado</button>`;
    return;
  }

  if (!product.precio) {
    bar.innerHTML = `
      <button class="consultar-wa-btn" onclick="consultarWhatsApp()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Consultar precio por WhatsApp
      </button>`;
    return;
  }

  const extrasTotal = getExtras().reduce((sum, e) => sum + (extrasQty[e.id] || 0) * e.precio, 0);
  const total       = (product.precio + extrasTotal) * qty;

  bar.innerHTML = `
    <div class="qty-bar-control">
      <button class="qty-bar-btn" onclick="changeQty(-1)">−</button>
      <span class="qty-bar-num" id="qtyNum">${qty}</span>
      <button class="qty-bar-btn" onclick="changeQty(1)">+</button>
    </div>
    <button class="agregar-btn" onclick="agregarAlCarrito()">
      <span>Agregar al pedido</span>
      <span class="agregar-btn-price">${CONFIG.moneda}&nbsp;${total.toLocaleString("es-AR")}</span>
    </button>`;
}

function changeQty(delta) {
  qty = Math.max(1, qty + delta);
  const el = document.getElementById("qtyNum");
  if (el) el.textContent = qty;
  renderBottomBar();
}

// ===== CARRITO =====

function agregarAlCarrito() {
  const aclaraciones    = document.getElementById("aclaraciones").value.trim();
  const selectedExtras  = getExtras()
    .filter(e => (extrasQty[e.id] || 0) > 0)
    .map(e => ({ id: e.id, nombre: e.nombre, precio: e.precio, qty: extrasQty[e.id] }));

  let cart = [];
  try { cart = JSON.parse(localStorage.getItem("tienda_cart") || "[]"); } catch {}

  const existing = cart.find(i => i.id === product.id);
  if (existing) {
    existing.qty += qty;
    if (aclaraciones) existing.aclaraciones = aclaraciones;
  } else {
    cart.push({
      id:           product.id,
      nombre:       product.nombre,
      precio:       product.precio,
      emoji:        product.emoji,
      qty,
      aclaraciones,
      extras:       selectedExtras,
    });
  }

  localStorage.setItem("tienda_cart", JSON.stringify(cart));
  showConfirmation();
}

function showConfirmation() {
  const selectedExtras = getExtras().filter(e => (extrasQty[e.id] || 0) > 0);
  const extrasHtml = selectedExtras.length
    ? `<ul style="list-style:none;margin:0 0 1.2rem;padding:0;text-align:left">${
        selectedExtras.map(e =>
          `<li style="font-size:0.8rem;color:var(--text-2);padding:0.15rem 0">+ ${e.nombre} × ${extrasQty[e.id]}</li>`
        ).join("")
      }</ul>`
    : "";

  const overlay = document.createElement("div");
  overlay.className = "added-overlay";
  overlay.innerHTML = `
    <div class="added-card">
      <div class="added-check">✓</div>
      <p class="added-title">¡Agregado al pedido!</p>
      <p class="added-subtitle">${product.nombre} × ${qty}</p>
      ${extrasHtml}
      <div class="added-actions">
        <button class="added-secondary-btn" onclick="window.location.href='tienda-whatsapp-sheets.html'">
          Seguir eligiendo
        </button>
        <button class="added-primary-btn" onclick="window.location.href='tienda-whatsapp-sheets.html#cart'">
          Ver carrito →
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

// ===== WHATSAPP CONSULTA =====

function consultarWhatsApp() {
  const aclaraciones = document.getElementById("aclaraciones").value.trim();
  let msg = `Hola, te quiero consultar que precio tiene ${product.nombre}`;
  if (aclaraciones) msg += `\n\nAclaraciones: ${aclaraciones}`;
  window.open(`https://wa.me/${CONFIG.whatsappNumero}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ===== NAVEGACIÓN =====

function goBack() {
  if (document.referrer && document.referrer.includes(window.location.hostname)) {
    history.back();
  } else {
    window.location.href = "tienda-whatsapp-sheets.html";
  }
}

init();
