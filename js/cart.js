// ============================================================
// js/cart.js — Carrito + Checkout con opción recojo / delivery
// ============================================================

const Cart = (() => {
  let items = JSON.parse(localStorage.getItem('cv_cart') || '[]');
  let _config = {};

  const _save = () => localStorage.setItem('cv_cart', JSON.stringify(items));
  const _render = () => { _renderItems(); _renderBadge(); _renderTotal(); _save(); };

  const _renderItems = () => {
    const container = document.getElementById('cart-items');
    const empty = document.getElementById('cart-empty');
    const footer = document.getElementById('cart-footer');
    if (!container) return;

    if (!items.length) {
      container.innerHTML = '';
      empty?.classList.remove('hidden');
      footer?.classList.add('hidden');
      return;
    }
    empty?.classList.add('hidden');
    footer?.classList.remove('hidden');

    container.innerHTML = items.map(item => {
      const subtotal = (item.precio * item.cantidad).toFixed(2);
      return `
        <div class="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
          <div class="shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-verde-pale">
            <img src="${item.imgurl}" alt="${item.nombre}" class="w-full h-full object-cover" onerror="this.style.display='none'">
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm truncate">${item.nombre}</div>
            <div class="text-xs text-gray-400">S/${Number(item.precio).toFixed(2)} / ${item.unidad}</div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="Cart.removeItem(${item.id})"
                    class="w-7 h-7 rounded-lg border-2 border-gray-200 hover:border-verde flex items-center justify-center font-bold text-base leading-none transition-colors">−</button>
            <span class="w-6 text-center font-bold text-sm">${item.cantidad}</span>
            <button onclick="Cart.addItem(${JSON.stringify(item).replace(/"/g, '&quot;')})"
                    ${item.cantidad >= item.stock ? 'disabled' : ''}
                    class="w-7 h-7 rounded-lg border-2 border-gray-200 hover:border-verde flex items-center justify-center font-bold text-base leading-none transition-colors disabled:opacity-30">+</button>
          </div>
          <div class="font-bold text-verde text-sm w-16 text-right shrink-0">S/${subtotal}</div>
          <button onclick="Cart.deleteItem(${item.id})" class="text-gray-300 hover:text-red-400 transition-colors shrink-0 ml-1">🗑</button>
        </div>`;
    }).join('');

    const h = document.getElementById('cart-count-header');
    if (h) h.textContent = `(${_totalItems()} items)`;
  };

  const _renderBadge = () => {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    const n = _totalItems();
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
  };

  const _renderTotal = () => {
    const el = document.getElementById('cart-total');
    if (el) el.textContent = `S/${_totalPrice().toFixed(2)}`;
  };

  const _totalItems = () => items.reduce((s, i) => s + i.cantidad, 0);
  const _totalPrice = () => items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  return {
    init(config = {}) { _config = config; _render(); },

    addItem(producto) {
      const existe = items.find(i => i.id === producto.id);
      if (existe) {
        if (existe.cantidad >= producto.stock) { showToast(`Solo quedan ${producto.stock} unidades`, 'error'); return; }
        existe.cantidad++;
      } else {
        items.push({ ...producto, cantidad: 1 });
      }
      _render();
    },

    addItemCantidad(producto, cantidad) {
      const existe = items.find(i => i.id === producto.id);
      if (existe) {
        const nueva = existe.cantidad + cantidad;
        if (nueva > producto.stock) { showToast(`Solo hay ${producto.stock} ${producto.unidad} disponibles`, 'error'); return; }
        existe.cantidad = nueva;
      } else {
        items.push({ ...producto, cantidad });
      }
      _render();
      showToast(`${cantidad} ${producto.unidad} de ${producto.nombre} al carrito`);
    },

    removeItem(id) {
      const item = items.find(i => i.id === id);
      if (!item) return;
      item.cantidad--;
      if (item.cantidad <= 0) items = items.filter(i => i.id !== id);
      _render();
    },

    deleteItem(id) { items = items.filter(i => i.id !== id); _render(); },
    clear() { items = []; _render(); },

    toggle() {
      document.getElementById('cart-drawer')?.classList.toggle('open');
      document.getElementById('cart-overlay')?.classList.toggle('open');
    },
    close() {
      document.getElementById('cart-drawer')?.classList.remove('open');
      document.getElementById('cart-overlay')?.classList.remove('open');
    },
    goToCheckout() { Cart.close(); Checkout.open(items, _config); },

    getItems: () => items,
    getTotalItems: () => _totalItems(),
    getTotalPrice: () => _totalPrice(),
  };
})();


// ============================================================
// MÓDULO CHECKOUT — 3 pasos con opción recojo / delivery
// ============================================================
const Checkout = (() => {
  let _items = [];
  let _config = {};
  let _pedidoId = null;
  let _pedidoTotal = 0;

  const COSTO_DELIVERY = 2.00; // costo fijo del delivery en soles

  // Leer qué opción de entrega está seleccionada
  const _tipoEntrega = () =>
    document.querySelector('input[name="tipo-entrega"]:checked')?.value || 'recojo';

  // Total con o sin delivery según la opción elegida
  const _totalConEntrega = () => {
    const sub = Cart.getTotalPrice();
    return _tipoEntrega() === 'delivery' ? sub + COSTO_DELIVERY : sub;
  };

  // ── Se llama cada vez que el usuario cambia la opción ─────
  // Actualiza el resumen de precios y muestra/oculta el campo dirección
  const actualizarEntrega = () => {
    const esDelivery = _tipoEntrega() === 'delivery';

    // ← AGREGAR ESTA LÍNEA para llenar el subtotal correctamente
    const subEl = document.getElementById('resumen-subtotal');
    if (subEl) subEl.textContent = `S/${Cart.getTotalPrice().toFixed(2)}`;

    // Mostrar/ocultar fila del costo de delivery en el resumen
    document.getElementById('fila-delivery')?.classList.toggle('hidden', !esDelivery);

    // Actualizar el total mostrado
    const totalEl = document.getElementById('resumen-total');
    if (totalEl) totalEl.textContent = `S/${_totalConEntrega().toFixed(2)}`;

    // Mostrar/ocultar el campo de dirección (solo si es delivery)
    const bloqueDir = document.getElementById('bloque-direccion');
    if (bloqueDir) bloqueDir.classList.toggle('hidden', !esDelivery);

    // Las dos opciones: resaltar visualmente la seleccionada
    document.getElementById('card-recojo')?.classList.toggle('border-verde', !esDelivery);
    document.getElementById('card-recojo')?.classList.toggle('bg-verde-pale', !esDelivery);
    document.getElementById('card-recojo')?.classList.toggle('border-gray-200', esDelivery);
    document.getElementById('card-recojo')?.classList.toggle('bg-white', esDelivery);

    document.getElementById('card-delivery')?.classList.toggle('border-verde', esDelivery);
    document.getElementById('card-delivery')?.classList.toggle('bg-verde-pale', esDelivery);
    document.getElementById('card-delivery')?.classList.toggle('border-gray-200', !esDelivery);
    document.getElementById('card-delivery')?.classList.toggle('bg-white', !esDelivery);
  };

  const open = (items, config) => {
    _items = [...items];
    _config = config;
    _renderPaso1();
    _irPaso(1);
    document.getElementById('checkout-modal')?.classList.add('open');
    document.getElementById('modal-close-btn')?.classList.remove('hidden');
  };

  const close = () => document.getElementById('checkout-modal')?.classList.remove('open');

  const _irPaso = (n) => {
    [1, 2, 3].forEach(i =>
      document.getElementById(`checkout-paso-${i}`)?.classList.toggle('hidden', i !== n)
    );
    [1, 2, 3].forEach(i => {
      const c = document.getElementById(`step-${i}`);
      const l = document.getElementById(`line-${i}`);
      if (c) {
        c.className = c.className.replace(/\bactive\b|\bdone\b/g, '').trim();
        if (i < n) c.classList.add('done');
        else if (i === n) c.classList.add('active');
      }
      if (l) l.classList.toggle('done', i < n);
    });
    // Al entrar al paso 2 inicializar el estado visual
    if (n === 2) setTimeout(actualizarEntrega, 30);
  };

  // ── Paso 1: lista de productos ────────────────────────────
  const _renderPaso1 = () => {
    const c = document.getElementById('checkout-items');
    if (!c) return;
    c.innerHTML = _items.map(item => `
      <div class="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0 gap-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg overflow-hidden bg-verde-pale shrink-0">
            <img src="${item.imgurl}" alt="${item.nombre}" class="w-full h-full object-cover" onerror="this.style.display='none'">
          </div>
          <span class="font-medium">${item.nombre}</span>
        </div>
        <span class="text-gray-400 shrink-0">${item.cantidad} ${item.unidad}</span>
        <span class="font-bold text-verde shrink-0">S/${(item.precio * item.cantidad).toFixed(2)}</span>
      </div>`).join('') + `
      <div class="flex justify-between font-bold text-verde pt-3 mt-1 border-t-2 border-verde/20 text-base">
        <span>Total (${Cart.getTotalItems()} items)</span>
        <span>S/${Cart.getTotalPrice().toFixed(2)}</span>
      </div>`;
  };

  // ── Paso 2: validar y enviar pedido ───────────────────────
  const confirmar = async () => {
    const nombre = document.getElementById('inp-nombre')?.value.trim();
    const apellido = document.getElementById('inp-apellido')?.value.trim();
    const telefono = document.getElementById('inp-telefono')?.value.trim();
    const localidad = document.getElementById('inp-localidad')?.value.trim();
    const notas = document.getElementById('inp-notas')?.value.trim();
    const esDelivery = _tipoEntrega() === 'delivery';
    const direccion = document.getElementById('inp-direccion')?.value.trim();

    let valido = true;
    const v = (inputId, errId, ok) => {
      document.getElementById(inputId)?.classList.toggle('error', !ok);
      document.getElementById(errId)?.classList.toggle('hidden', ok);
      if (!ok) valido = false;
    };

    v('inp-nombre', 'err-nombre', !!nombre);
    v('inp-apellido', 'err-apellido', !!apellido);
    v('inp-telefono', 'err-telefono', /^[\d\s\-\+\(\)]{7,15}$/.test(telefono));
    v('inp-localidad', 'err-localidad', !!localidad);
    // Dirección obligatoria solo si elige delivery
    if (esDelivery) v('inp-direccion', 'err-direccion', !!direccion);

    if (!valido) return;

    const btn = document.getElementById('btn-confirmar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Procesando...'; }

    try {
      const totalFinal = _totalConEntrega();
      const subtotalProductos = Cart.getTotalPrice();

      const res = await Api.crearPedido({
        nombre_cliente: nombre,
        apellido,
        telefono,
        direccion: esDelivery ? direccion : 'RECOJO EN TIENDA',
        localidad,
        notas,
        items: _items.map(i => ({ producto_id: i.id, cantidad: i.cantidad }))
        // Nota: el total en la BD se guarda sin el delivery porque la tabla
        // solo conoce los productos. El total real se muestra en el WhatsApp.
      });

      _pedidoId = res.pedido_id;
      _pedidoTotal = totalFinal;

      Cart.clear();
      _renderPaso3({
        nombre, apellido, pedidoId: res.pedido_id,
        total: totalFinal, subtotal: subtotalProductos,
        esDelivery, direccion, localidad,
        telefono, notas
      });
      _irPaso(3);
      document.getElementById('modal-close-btn')?.classList.add('hidden');

    } catch (err) {
      showToast(err.message || 'Error al procesar el pedido', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✓ Confirmar Pedido'; }
    }
  };

  // ── Paso 3: construir mensaje de WhatsApp ─────────────────
  const _renderPaso3 = ({ nombre, apellido, pedidoId, total, subtotal, esDelivery, direccion, localidad, telefono, notas }) => {
    const msg = document.getElementById('checkout-success-msg');
    if (msg) msg.innerHTML = `Tu pedido <strong>#${pedidoId}</strong> fue registrado.<br>
      Tocá el botón para enviarlo por WhatsApp y lo preparamos para vos.`;

    const tienda = _config.nombre_tienda || 'La Canasta Verde';
    const lineas = _items.map(i =>
      `  🌿 ${i.nombre}: ${i.cantidad} ${i.unidad} × S/${Number(i.precio).toFixed(2)} = S/${(i.precio * i.cantidad).toFixed(2)}`
    );

    const mensaje = [
      `🥬 *Nuevo Pedido — ${tienda}*`,
      `━━━━━━━━━━━━━━━━━━━`,
      `👤 *Nombre:* ${nombre} ${apellido}`,
      `📞 *Teléfono:* ${telefono}`,
      // Tipo de entrega resaltado
      esDelivery
        ? `🚚 *Entrega:* Delivery a domicilio`
        : `🏪 *Entrega:* Recojo en tienda`,
      esDelivery ? `📍 *Dirección:* ${direccion}` : null,
      `🏘️ *Localidad:* ${localidad}`,
      notas ? `📝 *Notas:* ${notas}` : null,
      `━━━━━━━━━━━━━━━━━━━`,
      `🛒 *Productos:*`,
      ...lineas,
      `━━━━━━━━━━━━━━━━━━━`,
      `  Subtotal: S/${subtotal.toFixed(2)}`,
      esDelivery ? `  Delivery: S/${COSTO_DELIVERY.toFixed(2)}` : null,
      `💰 *TOTAL: S/${Number(total).toFixed(2)}*`,
      `🔖 Pedido #${pedidoId}`,
    ].filter(Boolean).join('\n');

    const link = `https://wa.me/${_config.telefono_wsp || ''}?text=${encodeURIComponent(mensaje)}`;
    const btnW = document.getElementById('btn-whatsapp');
    if (btnW) btnW.href = link;
  };

  return { open, close, confirmar, irPaso: _irPaso, actualizarEntrega };
})();