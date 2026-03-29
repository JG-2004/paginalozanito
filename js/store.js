// ============================================================
// js/store.js — Tienda pública con selector de cantidad en tarjetas
// ============================================================

let _productos    = [];
let _categorias   = [];
let _filtroActual = 'todos';
let _config       = {};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [prodRes, catRes, cfgRes] = await Promise.all([
      Api.getProductos(),
      Api.getCategorias(),
      Api.getConfig(),
    ]);
    _productos  = prodRes.data;
    _categorias = catRes.data;
    _config     = cfgRes.data;

    Cart.init(_config);
    _renderFiltros();
    _renderProductos();
    _actualizarHero();
    _iniciarCountdown();

  } catch (err) {
    console.error('Error cargando la tienda:', err);
    document.getElementById('loading-state').innerHTML = `
      <div class="text-5xl mb-3">😔</div>
      <p class="text-gray-400">No se pudieron cargar los productos. Recargá la página.</p>`;
  }
});

// ── Filtros ──────────────────────────────────────────────────
const _renderFiltros = () => {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  const filtros = [
    { slug:'todos', nombre:'Todos', emoji:'🛒', count: _productos.length },
    ..._categorias.map(c => ({
      slug: c.slug, nombre: c.nombre, emoji: c.emoji,
      count: _productos.filter(p => p.categoria_slug === c.slug).length,
    })).filter(c => c.count > 0),
  ];
  bar.innerHTML = filtros.map(f => `
    <button onclick="filtrarPor('${f.slug}')" data-slug="${f.slug}"
            class="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all
                   ${f.slug === _filtroActual
                     ? 'bg-verde border-verde text-white shadow-card'
                     : 'bg-white border-gray-200 text-gray-700 hover:border-verde-light shadow-sm'}">
      ${f.emoji} ${f.nombre} <span class="font-normal opacity-60">(${f.count})</span>
    </button>`).join('');
};

function filtrarPor(slug) {
  _filtroActual = slug;
  _renderFiltros();
  _renderProductos();
}

// ── Grilla de productos ──────────────────────────────────────
const _renderProductos = () => {
  const grid    = document.getElementById('product-grid');
  const loading = document.getElementById('loading-state');
  const empty   = document.getElementById('empty-state');
  if (!grid) return;

  loading?.classList.add('hidden');

  const filtrados = _filtroActual === 'todos'
    ? _productos
    : _productos.filter(p => p.categoria_slug === _filtroActual);

  if (!filtrados.length) {
    grid.innerHTML = '';
    empty?.classList.remove('hidden');
    empty?.classList.add('flex');
    return;
  }
  empty?.classList.add('hidden');
  empty?.classList.remove('flex');
  grid.innerHTML = filtrados.map(_tarjeta).join('');
};

// ── Tarjeta de producto con selector de cantidad ─────────────
// Igual que la imagen modelo: campo numérico + botón "Agregar al carrito"
const _tarjeta = (p) => {
  const pct      = p.stock_max > 0 ? Math.round((p.stock / p.stock_max) * 100) : 0;
  const barColor = pct > 60 ? '#52b788' : pct > 25 ? '#f4d03f' : '#e76f51';
  const agotado  = p.stock === 0;

  return `
    <div class="product-card bg-white rounded-2xl shadow-card hover:shadow-hover
                transition-all duration-200 flex flex-col overflow-hidden relative
                ${agotado ? 'opacity-60' : ''}">

      ${agotado ? `
        <div class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 pointer-events-none rounded-2xl">
          <span class="font-hand text-2xl text-naranja rotate-[-8deg] inline-block">AGOTADO</span>
        </div>` : ''}

      <!-- Imagen del producto -->
      <div class="w-full h-40 bg-verde-pale overflow-hidden">
        <img src="${p.imgurl}"
             alt="${p.nombre}"
             loading="lazy"
             class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
             onerror="this.parentElement.innerHTML='<div class=\'w-full h-full flex items-center justify-center text-5xl bg-verde-pale\'>🥬</div>'">
      </div>

      <!-- Contenido -->
      <div class="p-3 flex flex-col flex-1">

        <!-- Nombre -->
        <div class="font-display text-base leading-tight mb-0.5">${p.nombre}</div>

        <!-- Categoría -->
        <div class="text-xs text-gray-400 uppercase tracking-wider mb-1">
          ${p.categoria_emoji} ${p.categoria}
        </div>

        <!-- Descripción -->
        ${p.descripcion ? `<div class="text-xs text-gray-400 mb-2 leading-relaxed line-clamp-2">${p.descripcion}</div>` : ''}

        <!-- Precio -->
        <div class="text-lg font-bold text-verde mt-auto mb-2">
          S/${Number(p.precio).toFixed(2)}
          <span class="text-xs font-normal text-gray-400">/ ${p.unidad}</span>
        </div>

        <!-- Barra de stock -->
        <div class="mb-3">
          <div class="flex justify-between text-xs text-gray-400 mb-1">
            <span>Stock</span><span>${p.stock} / ${p.stock_max}</span>
          </div>
          <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div class="stock-fill h-full rounded-full" style="width:${pct}%;background:${barColor}"></div>
          </div>
        </div>

        <!-- ── SELECTOR DE CANTIDAD + BOTÓN AGREGAR ────────────
             Igual al modelo de la imagen:
             [ − ] [ 1 ] [ + ]  (unidad)
             [   Agregar al carrito   ]              -->
        <div class="flex flex-col gap-2 ${agotado ? 'pointer-events-none opacity-40' : ''}">

          <!-- Fila de cantidad -->
          <div class="flex items-center gap-2">
            <!-- Botón restar -->
            <button
              onclick="cambiarCantidad('qty-${p.id}', -1, ${p.stock})"
              class="w-8 h-8 rounded-lg border-2 border-gray-200 hover:border-verde
                     flex items-center justify-center text-lg leading-none
                     transition-colors font-bold text-gray-600 hover:text-verde shrink-0">
              −
            </button>

            <!-- Input de cantidad: el usuario puede escribir directamente -->
            <input
              id="qty-${p.id}"
              type="number"
              value="1"
              min="1"
              max="${p.stock}"
              ${agotado ? 'disabled' : ''}
              class="w-full text-center border-2 border-gray-200 rounded-lg py-1.5
                     text-sm font-bold focus:outline-none focus:border-verde transition-colors
                     [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">

            <!-- Botón sumar -->
            <button
              onclick="cambiarCantidad('qty-${p.id}', +1, ${p.stock})"
              class="w-8 h-8 rounded-lg border-2 border-gray-200 hover:border-verde
                     flex items-center justify-center text-lg leading-none
                     transition-colors font-bold text-gray-600 hover:text-verde shrink-0">
              +
            </button>

            <!-- Etiqueta de unidad -->
            <span class="text-xs text-gray-400 shrink-0">${p.unidad}</span>
          </div>

          <!-- Botón Agregar al carrito -->
          <button
            onclick="agregarAlCarrito(this, ${JSON.stringify(p).replace(/"/g,'&quot;')})"
            ${agotado ? 'disabled' : ''}
            data-qty-id="qty-${p.id}"
            class="w-full py-2.5 rounded-xl text-sm font-bold transition-all
                   ${agotado
                     ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                     : 'bg-verde hover:bg-verde-dark active:scale-95 text-white'}">
            🛒 Agregar al carrito
          </button>
        </div>

      </div>
    </div>`;
};

// ── Cambiar cantidad con los botones + / − ────────────────────
// Se llama desde los botones inline de la tarjeta
function cambiarCantidad(inputId, delta, stockMax) {
  const input = document.getElementById(inputId);
  if (!input) return;
  let val = parseInt(input.value) || 1;
  val = Math.max(1, Math.min(stockMax, val + delta)); // entre 1 y el stock máximo
  input.value = val;
}

// ── Agregar al carrito con la cantidad elegida ────────────────
function agregarAlCarrito(btn, producto) {
  // Leer la cantidad del input correspondiente a este producto
  const input    = document.getElementById(`qty-${producto.id}`);
  const cantidad = Math.max(1, parseInt(input?.value) || 1);

  // Validar contra el stock disponible
  if (cantidad > producto.stock) {
    showToast(`Solo hay ${producto.stock} ${producto.unidad} disponibles`, 'error');
    return;
  }

  // Agregar al carrito con la cantidad específica
  Cart.addItemCantidad(producto, cantidad);

  // Feedback visual en el botón
  const orig = btn.textContent;
  btn.textContent = `✓ Agregado (${cantidad} ${producto.unidad})`;
  btn.classList.replace('bg-verde', 'bg-verde-dark');
  setTimeout(() => {
    btn.textContent = orig;
    btn.classList.replace('bg-verde-dark', 'bg-verde');
    if (input) input.value = 1; // resetear el input a 1
  }, 1800);
}

// ── Hero ──────────────────────────────────────────────────────
const _actualizarHero = () => {
  const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const dia  = DIAS[parseInt(_config.dia_venta)] || 'Sábado';
  const tag  = document.getElementById('hero-tag');
  if (tag) tag.textContent = `📅 Vendemos los ${dia}s · ${_config.hora_inicio || '08:00'} a ${_config.hora_fin || '13:00'}`;
  const footer = document.getElementById('footer-horario');
  if (footer) footer.textContent = `Los ${dia}s de ${_config.hora_inicio || '08:00'} a ${_config.hora_fin || '13:00'}`;
};

// ── Countdown ─────────────────────────────────────────────────
const _iniciarCountdown = () => {
  const getNext = () => {
    const now = new Date();
    const dia = parseInt(_config.dia_venta) || 6;
    const [hh, mm] = (_config.hora_inicio || '08:00').split(':').map(Number);
    let d = new Date(now);
    d.setHours(hh, mm, 0, 0);
    let t = 0;
    while (d.getDay() !== dia || d <= now) { d.setDate(d.getDate() + 1); if (++t > 14) break; }
    return d;
  };
  const pad = n => String(n).padStart(2,'0');
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = pad(v); };
  const tick = () => {
    const diff = getNext() - new Date();
    if (diff <= 0) { ['cd-days','cd-hours','cd-mins','cd-secs'].forEach(id => set(id,0)); return; }
    set('cd-days',  Math.floor(diff / 86400000));
    set('cd-hours', Math.floor((diff % 86400000) / 3600000));
    set('cd-mins',  Math.floor((diff % 3600000)  / 60000));
    set('cd-secs',  Math.floor((diff % 60000)    / 1000));
  };
  tick();
  setInterval(tick, 1000);
};