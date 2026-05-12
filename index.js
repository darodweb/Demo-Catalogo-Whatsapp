// ============================================================
//  CONFIGURACIÓN — EDITÁ ESTOS VALORES
// ============================================================
const CONFIG = {
  nombre:         "Mi Tienda Online",
  tagline:        "Pedí fácil, recibí rápido",
  heroTitle:      "¡Bienvenido a nuestra tienda!",
  heroSubtitle:   "Elegí tus productos y recibís el pedido por WhatsApp",
  moneda:         "$",
  whatsappNumero: "5493547604687",  // código país + número, sin + ni espacios

  // Pegá acá el ID de tu Google Sheet (está en la URL:
  // https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit)
  sheetId:   "17RHQZA7ri9J_ZeDD0F_IN53J5OwchQBBzw4ONJnkFsk",
  sheetName: "Productos",
};
// ============================================================

// Columnas esperadas en el Sheet (fila 1 = encabezados, exactamente estos nombres):
// nombre | descripcion | precio | categoria | emoji | imagen | badge | disponible
//
// disponible: escribí TRUE o FALSE (o dejalo vacío = TRUE)

let products = [];
let cart = [];
let activeCategory = "Todos";

function init() {
  // Cargar carrito persistido desde localStorage
  try {
    const saved = localStorage.getItem("tienda_cart");
    if (saved) cart = JSON.parse(saved);
  } catch {}

  document.getElementById("storeName").textContent    = CONFIG.nombre;
  document.getElementById("storeTagline").textContent = CONFIG.tagline;
  document.getElementById("heroTitle").textContent    = CONFIG.heroTitle;
  document.getElementById("heroSubtitle").textContent = CONFIG.heroSubtitle;
  document.title = CONFIG.nombre;

  document.getElementById("deliveryMethod").addEventListener("change", function () {
    document.getElementById("addressGroup").style.display = this.value === "envio" ? "block" : "none";
  });

  // Sincronizar carrito al volver desde la página de producto
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      try {
        const saved = localStorage.getItem("tienda_cart");
        if (saved) { cart = JSON.parse(saved); updateCartCount(); renderProducts(); }
      } catch {}
    }
  });

  loadProducts();

  if (window.location.hash === '#cart') {
    window.history.replaceState(null, '', window.location.pathname);
    openCart();
  }
}

async function loadProducts() {
  document.getElementById("loadingState").style.display = "block";
  document.getElementById("storeContent").style.display  = "none";
  document.getElementById("errorBanner").style.display   = "none";

  if (CONFIG.sheetId === "TU_SHEET_ID_AQUI") {
    showError(
      "Falta configurar el Google Sheet",
      `Abrí el archivo HTML, buscá <code class="code-tag">sheetId</code> y pegá el ID de tu planilla.
       <br><a href="#instrucciones">Ver instrucciones paso a paso ↓</a>`
    );
    showDemoProducts();
    return;
  }

  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CONFIG.sheetName)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const parsed = parseCSV(csv);
    if (parsed.length === 0) throw new Error("La hoja está vacía o no tiene productos.");
    products = parsed;
    document.getElementById("lastUpdated").textContent = new Date().toLocaleTimeString("es-AR");
    render();
  } catch (err) {
    showError(
      "No se pudo cargar el catálogo",
      `Verificá que la planilla esté publicada (Archivo → Compartir → Publicar en la web).
       <br><small>Error: ${err.message}</small>`
    );
    showDemoProducts();
  }
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());

  const get = (row, name) => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? (row[idx] || "").trim() : "";
  };

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
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function showDemoProducts() {
  products = [
    { id:1, nombre:"Producto de ejemplo",  descripcion:"Así se verían tus productos cargados en el Sheet", precio:1500, categoria:"Demo", emoji:"✨", disponible:true },
    { id:2, nombre:"Otro producto",         descripcion:"Editá el Google Sheet y los cambios se reflejan aquí",  precio:2000, categoria:"Demo", emoji:"🎯", badge:"Nuevo", disponible:true },
    { id:3, nombre:"Producto agotado",      descripcion:"Si ponés FALSE en la columna disponible, se muestra así", precio:900, categoria:"Demo", emoji:"🔒", disponible:false },
  ];
  render();
}

function render() {
  // Guardar en sessionStorage para que producto.html pueda leerlos sin refetch
  sessionStorage.setItem("tienda_products", JSON.stringify(products));
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("storeContent").style.display = "block";
  renderCategories();
  renderProducts();
}

function renderCategories() {
  const cats = ["Todos", ...new Set(products.map(p => p.categoria).filter(Boolean))];
  if (!cats.includes(activeCategory)) activeCategory = "Todos";
  document.getElementById("categoriesBar").innerHTML = cats.map(cat =>
    `<button class="cat-btn ${cat === activeCategory ? 'active' : ''}" onclick="filterCat('${cat}')">${cat}</button>`
  ).join("");
}

function filterCat(cat) {
  activeCategory = cat;
  renderCategories();
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  const filtered = activeCategory === "Todos" ? products : products.filter(p => p.categoria === activeCategory);

  if (!filtered.length) {
    grid.innerHTML = '<p style="color:var(--text-3);grid-column:1/-1;padding:3rem 0;text-align:center;font-size:0.9rem">No hay productos en esta categoría.</p>';
    return;
  }

  grid.innerHTML = filtered.map((p, idx) => {
    const inCart = cart.find(i => i.id === p.id);
    const delay  = `animation-delay:${idx * 0.04}s`;

    const imgBlock = p.imagen
      ? `<div class="product-img-wrap"><img src="${p.imagen}" alt="${p.nombre}" loading="lazy"></div>`
      : `<div class="product-emoji">${p.emoji}</div>`;

    const stockLabel = !p.disponible
      ? `<span class="stock-label">Agotado</span>`
      : "";

    const sinPrecio = p.disponible && !p.precio;

    const actionBlock = !p.disponible
      ? `<button class="add-btn" disabled style="background:var(--surface-3);color:var(--text-3);cursor:default">✕</button>`
      : sinPrecio
        ? `<button class="consultar-btn" onclick="consultarPrecio(${p.id})">Consultar</button>`
        : inCart
          ? `<div class="qty-control">
               <button class="qty-btn" onclick="changeQty(${p.id},-1)">−</button>
               <span class="qty-num">${inCart.qty}</span>
               <button class="qty-btn" onclick="changeQty(${p.id},1)">+</button>
             </div>`
          : `<button class="add-btn" onclick="addToCart(${p.id})">+</button>`;

    const priceDisplay = sinPrecio
      ? ``
      : `<span class="product-price">${CONFIG.moneda} ${p.precio.toLocaleString("es-AR")}</span>`;

    return `
      <div class="product-card ${!p.disponible ? 'out-of-stock' : ''}" style="${delay}" onclick="goToProduct(${p.id})">
        ${imgBlock}
        <div class="product-info">
          ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
          <div class="product-name">${p.nombre}</div>
          <div class="product-desc">${p.descripcion}</div>
          <div class="product-footer" onclick="event.stopPropagation()">
            <div>
              ${priceDisplay}
              ${stockLabel}
            </div>
            ${actionBlock}
          </div>
        </div>
      </div>`;
  }).join("");
}

function consultarPrecio(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const msg = `Hola, te quiero consultar que precio tiene ${p.nombre}`;
  window.open(`https://wa.me/${CONFIG.whatsappNumero}?text=${encodeURIComponent(msg)}`, "_blank");
}

function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const existing = cart.find(i => i.id === id);
  if (existing) existing.qty++;
  else cart.push({ ...p, qty: 1 });
  updateCartCount();
  renderProducts();
  showToast(`✓ ${p.nombre} agregado`);
}

function changeQty(id, delta) {
  const idx = cart.findIndex(i => i.id === id);
  if (idx < 0) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  updateCartCount();
  renderProducts();
  if (document.getElementById("cartModal").classList.contains("open")) renderCartModal();
}

function updateCartCount() {
  localStorage.setItem("tienda_cart", JSON.stringify(cart));
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const el = document.getElementById("cartCount");
  el.textContent = total;
  el.classList.remove("bump");
  void el.offsetWidth; // reflow to retrigger animation
  el.classList.add("bump");
}

function goToProduct(id) {
  window.location.href = `producto.html?id=${id}`;
}

function openCart()  { renderCartModal(); document.getElementById("cartModal").classList.add("open"); }
function closeCart() { document.getElementById("cartModal").classList.remove("open"); }

function handleOverlayClick(e) {
  if (e.target === document.getElementById("cartModal")) closeCart();
}

function renderCartModal() {
  const container = document.getElementById("cartItems");
  const form      = document.getElementById("checkoutForm");

  if (!cart.length) {
    container.innerHTML = `
      <div class="empty-cart">
        <span class="empty-cart-icon">🛒</span>
        Tu carrito está vacío.<br>
        <small style="color:var(--text-3)">Agregá productos para hacer tu pedido.</small>
      </div>`;
    form.style.display = "none";
    return;
  }

  const itemTotal = (i) => {
    const extrasSum = (i.extras || []).reduce((s, e) => s + e.precio * e.qty, 0);
    return (i.precio + extrasSum) * i.qty;
  };
  const total = cart.reduce((s, i) => s + itemTotal(i), 0);

  container.innerHTML = cart.map(i => {
    const extrasHtml = (i.extras && i.extras.length)
      ? `<div style="font-size:0.78rem;color:var(--text-2);margin-top:0.2rem;line-height:1.6">${
          i.extras.map(e => `+ ${e.nombre} × ${e.qty}`).join("<br>")
        }</div>`
      : "";
    return `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${i.nombre} × ${i.qty}</div>
        ${extrasHtml}
        <div class="cart-item-price">${CONFIG.moneda} ${itemTotal(i).toLocaleString("es-AR")}</div>
      </div>
      <div class="cart-item-actions">
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty(${i.id},-1)">−</button>
          <span class="qty-num">${i.qty}</span>
          <button class="qty-btn" onclick="changeQty(${i.id},1)">+</button>
        </div>
        <button class="remove-item" onclick="removeItem(${i.id})">🗑</button>
      </div>
    </div>`;
  }).join("") +
    `<div class="cart-total">
       <span class="cart-total-label">Subtotal</span>
       <span class="cart-total-value">${CONFIG.moneda} ${total.toLocaleString("es-AR")}</span>
     </div>`;

  form.style.display = "block";
}

function removeItem(id) {
  cart = cart.filter(i => i.id !== id);
  updateCartCount();
  renderProducts();
  renderCartModal();
}

function sendToWhatsApp() {
  const name = document.getElementById("clientName").value.trim();
  if (!name) { showToast("⚠️ Ingresá tu nombre"); return; }

  const phone    = document.getElementById("clientPhone").value.trim();
  const delivery = document.getElementById("deliveryMethod").value;
  const address  = document.getElementById("clientAddress").value.trim();
  const payment  = document.getElementById("paymentMethod").value;
  const notes    = document.getElementById("notes").value.trim();

  const itemTotal = (i) => {
    const extrasSum = (i.extras || []).reduce((s, e) => s + e.precio * e.qty, 0);
    return (i.precio + extrasSum) * i.qty;
  };
  const total = cart.reduce((s, i) => s + itemTotal(i), 0);

  const dLabels = { retiro: "Retiro en local", envio: "Envio a domicilio" };
  const pLabels = { efectivo: "Efectivo", transferencia: "Transferencia / Mercado Pago", tarjeta: "Tarjeta" };

  let msg = `*NUEVO PEDIDO - ${CONFIG.nombre}*\n\n`;
  msg += `*Cliente:* ${name}\n`;
  if (phone) msg += `*Telefono:* ${phone}\n`;
  msg += `\n*Productos:*\n`;
  cart.forEach(i => {
    msg += `- ${i.nombre} x ${i.qty} - ${CONFIG.moneda} ${itemTotal(i).toLocaleString("es-AR")}\n`;
    if (i.extras && i.extras.length) {
      i.extras.forEach(e => { msg += `  * ${e.nombre} x ${e.qty}\n`; });
    }
    if (i.aclaraciones) msg += `  Aclaraciones: ${i.aclaraciones}\n`;
  });
  msg += `\n*Total: ${CONFIG.moneda} ${total.toLocaleString("es-AR")}*\n`;
  msg += `\n*Entrega:* ${dLabels[delivery]}`;
  if (delivery === "envio" && address) msg += `\n*Direccion:* ${address}`;
  msg += `\n*Pago:* ${pLabels[payment]}`;
  if (notes) msg += `\n*Notas:* ${notes}`;

  window.open(`https://wa.me/${CONFIG.whatsappNumero}?text=${encodeURIComponent(msg)}`, "_blank");
}

function showError(title, detail) {
  const b = document.getElementById("errorBanner");
  b.style.display = "block";
  b.className = "error-state";
  b.innerHTML = `<strong>⚠️ ${title}</strong><p>${detail}</p>`;
  document.getElementById("loadingState").style.display = "none";
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

init();
