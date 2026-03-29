// ============================================================
// js/admin.js — Panel de Administración
// ============================================================

let _categorias={}, _productos=[], _pedidoActivo=null, _productoEditId=null, _configDia='6';
const DIAS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const ESTADO_COLOR={pendiente:'bg-yellow-100 text-yellow-800',confirmado:'bg-green-100 text-green-800',entregado:'bg-verde text-white',cancelado:'bg-red-100 text-red-600'};

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('admin_token')) _mostrarPanel();
});

const Admin = {
  // AUTH
  login: async () => {
    const pw=document.getElementById('login-password')?.value;
    const err=document.getElementById('login-error');
    try {
      const {token}=await Api.login(pw);
      localStorage.setItem('admin_token',token);
      err?.classList.add('hidden');
      _mostrarPanel();
    } catch { err?.classList.remove('hidden'); document.getElementById('login-password').value=''; }
  },
  logout: () => { localStorage.removeItem('admin_token'); window.location.reload(); },

  // TABS
  setTab: (btn) => {
    const id=btn.dataset.tab;
    document.querySelectorAll('.admin-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    ['stock','productos','pedidos','config'].forEach(t=>
      document.getElementById(`tab-${t}`)?.classList.toggle('hidden',t!==id));
    if(id==='stock')     Admin.cargarStock();
    if(id==='productos') Admin.cargarProductos();
    if(id==='pedidos')   Admin.cargarPedidos();
    if(id==='config')    Admin.cargarConfig();
  },

  // ── STOCK ──────────────────────────────────────────────────
  cargarStock: async () => {
    const lista=document.getElementById('stock-list');
    if(!lista)return;
    lista.innerHTML=`<div class="text-center py-8 text-gray-400">Cargando...</div>`;
    try {
      _productos=(await Api.getProductosAdmin()).data;
      _renderStockList();
    } catch(err){ lista.innerHTML=`<p class="text-red-400 text-center py-8">${err.message}</p>`; }
  },
  cambiarStock: async (id, delta) => {
    const p=_productos.find(x=>x.id===id); if(!p)return;
    const nuevo=Math.max(0,Math.min(p.stock_max,p.stock+delta));
    if(nuevo===p.stock)return;
    try { await Api.actualizarProducto(id,{stock:nuevo}); p.stock=nuevo; _renderStockList(); }
    catch(err){ showToast(err.message,'error'); }
  },
  toggleActivo: async (id, activo) => {
    try {
      await Api.actualizarProducto(id,{activo});
      const p=_productos.find(x=>x.id===id); if(p)p.activo=activo?1:0;
      _renderStockList();
      showToast(activo?'Producto activado ✓':'Producto desactivado');
    } catch(err){ showToast(err.message,'error'); }
  },

  // ── PRODUCTOS CRUD ─────────────────────────────────────────
  cargarProductos: async () => {
    const lista=document.getElementById('productos-list');
    if(!lista)return;
    lista.innerHTML=`<div class="text-center py-8 text-gray-400">Cargando...</div>`;
    try {
      [_productos,_categorias]=[(await Api.getProductosAdmin()).data,(await Api.getCategorias()).data];
      _renderProductosList(); _llenarCategorias();
    } catch(err){ lista.innerHTML=`<p class="text-red-400 text-center py-8">${err.message}</p>`; }
  },
  abrirFormProducto: (prod) => {
    _productoEditId=prod?.id||null;
    document.getElementById('modal-titulo').textContent=prod?'Editar producto':'Nuevo producto';
    ['nombre','imgurl','precio','unidad','stock','descripcion'].forEach(f=>{
      const el=document.getElementById(`prod-${f}`); if(el) el.value=prod?.[f]??'';
    });
    document.getElementById('prod-stock-max').value=prod?.stock_max??200;
    _llenarCategorias();
    if(prod) document.getElementById('prod-categoria').value=prod.categoria_id;
    _previewImg(prod?.imgurl||'');
    document.getElementById('modal-producto')?.classList.add('open');
  },
  cerrarModal: () => { document.getElementById('modal-producto')?.classList.remove('open'); _productoEditId=null; },
  guardarProducto: async () => {
    const data={
      nombre:       document.getElementById('prod-nombre').value.trim(),
      imgurl:       document.getElementById('prod-imgurl').value.trim(),
      categoria_id: document.getElementById('prod-categoria').value,
      precio:       parseFloat(document.getElementById('prod-precio').value),
      unidad:       document.getElementById('prod-unidad').value.trim()||'kg',
      stock:        parseInt(document.getElementById('prod-stock').value)||0,
      stock_max:    parseInt(document.getElementById('prod-stock-max').value)||200,
      descripcion:  document.getElementById('prod-descripcion').value.trim(),
    };
    if(!data.nombre||!data.precio||!data.categoria_id){showToast('Completá nombre, precio y categoría','error');return;}
    const btn=document.getElementById('btn-guardar-prod');
    if(btn){btn.disabled=true;btn.textContent='⏳ Guardando...';}
    try {
      if(_productoEditId){await Api.actualizarProducto(_productoEditId,data);showToast('Producto actualizado ✓');}
      else               {await Api.crearProducto(data);showToast('Producto creado ✓');}
      Admin.cerrarModal(); Admin.cargarProductos();
    } catch(err){showToast(err.message,'error');}
    finally{if(btn){btn.disabled=false;btn.textContent='Guardar producto';}}
  },
  eliminarProducto: async (id,nombre) => {
    if(!confirm(`¿Eliminar "${nombre}"?`))return;
    try{await Api.eliminarProducto(id);showToast('Eliminado');Admin.cargarProductos();}
    catch(err){showToast(err.message,'error');}
  },

  // ── PEDIDOS ────────────────────────────────────────────────
  cargarPedidos: async () => {
    const lista=document.getElementById('pedidos-list');
    const estado=document.getElementById('filtro-estado')?.value||'';
    if(!lista)return;
    lista.innerHTML=`<div class="text-center py-8 text-gray-400">Cargando...</div>`;
    try {
      const pedidos=(await Api.getPedidos(estado||null)).data;
      if(!pedidos.length){lista.innerHTML=`<div class="text-center py-12 text-gray-400"><div class="text-5xl mb-3">📋</div><p>No hay pedidos</p></div>`;return;}
      lista.innerHTML=pedidos.map(p=>`
        <div class="bg-white rounded-xl shadow-card p-4 flex items-center gap-3 flex-wrap">
          <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shrink-0 ${ESTADO_COLOR[p.estado]||'bg-gray-100'}">${p.estado}</span>
          <div class="flex-1 min-w-0">
            <div class="font-semibold">#${p.id} · ${p.nombre_cliente} ${p.apellido||''}</div>
            <div class="text-xs text-gray-400">${p.telefono} · ${p.localidad||''} · ${p.cantidad_items} items · S/${Number(p.total).toFixed(2)}</div>
            <div class="text-xs text-gray-300">${new Date(p.created_at).toLocaleString('es-PE')}</div>
          </div>
          <select data-id="${p.id}" onchange="Admin.cambiarEstadoRapido(this)"
                  class="input-cv bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-1.5 text-xs font-body">
            <option value="pendiente"  ${p.estado==='pendiente' ?'selected':''}>Pendiente</option>
            <option value="confirmado" ${p.estado==='confirmado'?'selected':''}>Confirmado</option>
            <option value="entregado"  ${p.estado==='entregado' ?'selected':''}>Entregado</option>
            <option value="cancelado"  ${p.estado==='cancelado' ?'selected':''}>Cancelado</option>
          </select>
          <button onclick="Admin.verPedido(${p.id})" class="text-gray-400 hover:text-verde text-lg transition-colors" title="Ver">👁️</button>
        </div>`).join('');
    } catch(err){lista.innerHTML=`<p class="text-red-400 text-center py-8">${err.message}</p>`;}
  },
  cambiarEstadoRapido: async (sel) => {
    try{await Api.actualizarEstadoPedido(sel.dataset.id,sel.value);showToast(`Pedido #${sel.dataset.id} → ${sel.value}`);Admin.cargarPedidos();}
    catch(err){showToast(err.message,'error');}
  },
  verPedido: async (id) => {
    try {
      const p=(await Api.getPedido(id)).data;
      _pedidoActivo=id;
      document.getElementById('pedido-modal-titulo').textContent=`Pedido #${id}`;
      document.getElementById('pedido-modal-info').innerHTML=`
        <p><strong>👤</strong> ${p.nombre_cliente} ${p.apellido||''}</p>
        <p><strong>📞</strong> ${p.telefono}</p>
        ${p.direccion?`<p><strong>📍</strong> ${p.direccion}</p>`:''}
        ${p.localidad?`<p><strong>🏘️</strong> ${p.localidad}</p>`:''}
        ${p.notas    ?`<p><strong>📝</strong> ${p.notas}</p>`:''}
        <p class="text-gray-400 text-xs mt-1">${new Date(p.created_at).toLocaleString('es-PE')}</p>`;
      document.getElementById('pedido-modal-items').innerHTML=
        (p.items||[]).map(i=>`
          <div class="flex items-center gap-2 text-sm py-2 border-b border-gray-100 last:border-0">
            ${renderImg(i.imgurl,'2rem','rounded-md shrink-0')}
            <span class="flex-1">${i.nombre}</span>
            <span class="text-gray-400">${i.cantidad} × S/${Number(i.precio).toFixed(2)}</span>
            <span class="font-bold text-verde">S/${Number(i.subtotal).toFixed(2)}</span>
          </div>`).join('')+
        `<div class="flex justify-between font-bold text-verde pt-2 mt-1 border-t-2 border-verde/20">
          <span>Total</span><span>S/${Number(p.total).toFixed(2)}</span></div>`;
      document.getElementById('pedido-modal-estado').value=p.estado;
      document.getElementById('modal-pedido')?.classList.add('open');
    } catch(err){showToast(err.message,'error');}
  },
  cambiarEstadoPedido: async (sel) => {
    if(!_pedidoActivo)return;
    try{await Api.actualizarEstadoPedido(_pedidoActivo,sel.value);showToast(`Estado → ${sel.value}`);}
    catch(err){showToast(err.message,'error');}
  },
  cerrarModalPedido: () => {
    document.getElementById('modal-pedido')?.classList.remove('open');
    _pedidoActivo=null; Admin.cargarPedidos();
  },

  // ── CONFIG ─────────────────────────────────────────────────
  cargarConfig: async () => {
    try {
      const cfg=(await Api.getConfig()).data;
      document.getElementById('cfg-hora-inicio').value=cfg.hora_inicio||'08:00';
      document.getElementById('cfg-hora-fin').value   =cfg.hora_fin   ||'13:00';
      document.getElementById('cfg-wsp').value        =cfg.telefono_wsp||'';
      document.getElementById('cfg-nombre').value     =cfg.nombre_tienda||'';
      _configDia=cfg.dia_venta||'6';
      _renderDiaPicker();
    } catch(err){showToast(err.message,'error');}
  },
  guardarConfig: async () => {
    try {
      await Api.guardarConfig({
        dia_venta:    _configDia,
        hora_inicio:  document.getElementById('cfg-hora-inicio')?.value,
        hora_fin:     document.getElementById('cfg-hora-fin')?.value,
        telefono_wsp: document.getElementById('cfg-wsp')?.value,
        nombre_tienda:document.getElementById('cfg-nombre')?.value,
      });
      showToast('Configuración guardada ✓');
    } catch(err){showToast(err.message,'error');}
  },
};

// ── Funciones privadas ───────────────────────────────────────

const _mostrarPanel = async () => {
  document.getElementById('login-screen')?.classList.add('hidden');
  document.getElementById('admin-app')?.classList.remove('hidden');
  _categorias=(await Api.getCategorias()).data;
  _llenarCategorias();
  Admin.cargarStock();
};

const _renderStockList = () => {
  const lista=document.getElementById('stock-list');
  if(!lista)return;
  if(!_productos.length){lista.innerHTML=`<div class="text-center py-8 text-gray-400">No hay productos</div>`;return;}
  lista.innerHTML=_productos.map(p=>{
    const pct=p.stock_max>0?Math.round((p.stock/p.stock_max)*100):0;
    const bar=pct>60?'#52b788':pct>25?'#f4d03f':'#e76f51';
    return `
      <div class="bg-white rounded-xl shadow-card px-4 py-3 flex items-center gap-3 flex-wrap ${!p.activo?'opacity-50':''}">
        <div class="shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-verde-pale">
          <img src="${p.imgurl}" alt="${p.nombre}" class="w-full h-full object-cover" onerror="this.style.display='none'">
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm">${p.nombre}</div>
          <div class="text-xs text-gray-400">${p.categoria} · S/${Number(p.precio).toFixed(2)}/${p.unidad}</div>
          <div class="h-1 bg-gray-100 rounded-full mt-1.5 w-24">
            <div class="h-full rounded-full stock-fill" style="width:${pct}%;background:${bar}"></div>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="Admin.cambiarStock(${p.id},-1)" class="w-8 h-8 rounded-full border-2 border-gray-200 hover:border-verde flex items-center justify-center text-lg transition-colors">−</button>
          <span class="w-8 text-center font-bold text-sm">${p.stock}</span>
          <button onclick="Admin.cambiarStock(${p.id},+1)" class="w-8 h-8 rounded-full border-2 border-gray-200 hover:border-verde flex items-center justify-center text-lg transition-colors">+</button>
        </div>
        <label class="flex items-center cursor-pointer" title="${p.activo?'Visible en tienda':'Oculto'}">
          <input type="checkbox" class="sr-only toggle-input" ${p.activo?'checked':''} onchange="Admin.toggleActivo(${p.id},this.checked)">
          <div class="toggle-track w-11 h-6 bg-gray-200 rounded-full relative transition-colors">
            <div class="toggle-thumb absolute w-4 h-4 bg-white rounded-full top-1 left-1 shadow transition-transform"></div>
          </div>
        </label>
      </div>`;
  }).join('');
};

const _renderProductosList = () => {
  const lista=document.getElementById('productos-list');
  if(!lista)return;
  if(!_productos.length){lista.innerHTML=`<div class="text-center py-8 text-gray-400">Sin productos. Creá el primero.</div>`;return;}
  lista.innerHTML=_productos.map(p=>`
    <div class="bg-white rounded-xl shadow-card px-4 py-3 flex items-center gap-3 hover:shadow-hover transition-shadow ${!p.activo?'opacity-50':''}">
      <div class="w-12 h-12 rounded-xl overflow-hidden bg-verde-pale shrink-0">
        <img src="${p.imgurl}" alt="${p.nombre}" class="w-full h-full object-cover" onerror="this.style.display='none'">
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold">${p.nombre} ${!p.activo?'<span class="text-xs text-naranja ml-1">● Inactivo</span>':''}</div>
        <div class="text-xs text-gray-400">${p.categoria} · S/${Number(p.precio).toFixed(2)}/${p.unidad} · Stock: ${p.stock}/${p.stock_max}</div>
      </div>
      <button onclick='Admin.abrirFormProducto(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="text-gray-400 hover:text-verde p-1 text-lg transition-colors">✏️</button>
      <button onclick="Admin.eliminarProducto(${p.id},'${p.nombre.replace(/'/g,"\\'")}' )" class="text-gray-400 hover:text-naranja p-1 text-lg transition-colors">🗑️</button>
    </div>`).join('');
};

const _llenarCategorias = () => {
  const sel=document.getElementById('prod-categoria');
  if(!sel||!_categorias.length)return;
  sel.innerHTML=`<option value="">Seleccionar...</option>`+
    _categorias.map(c=>`<option value="${c.id}">${c.emoji} ${c.nombre}</option>`).join('');
};

const _renderDiaPicker = () => {
  const picker=document.getElementById('dia-picker');
  if(!picker)return;
  picker.innerHTML=DIAS.map((n,i)=>`
    <button onclick="_selDia(${i},this)"
            class="px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition-all
                   ${String(i)===String(_configDia)?'bg-verde border-verde text-white':'bg-white border-gray-200 text-gray-600 hover:border-verde'}">
      ${n}
    </button>`).join('');
};

function _previewImg(url) {
  const prev=document.getElementById('img-preview');
  if(!prev)return;
  prev.innerHTML=url&&url.startsWith('http')
    ?`<img src="${url}" class="w-full h-full object-cover rounded-xl" onerror="this.parentElement.innerHTML='<div class=\'w-full h-full flex items-center justify-center text-gray-300 text-xs\'>URL inválida</div>'">`
    :`<span class="text-gray-300 text-xs">Vista previa de imagen</span>`;
}

function _selDia(i,btn) {
  _configDia=String(i);
  document.querySelectorAll('#dia-picker button').forEach((b,j)=>{
    const a=j===i;
    b.className=b.className.replace(/bg-verde border-verde text-white|bg-white border-gray-200 text-gray-600 hover:border-verde/g,'').trim();
    b.classList.add(...(a?['bg-verde','border-verde','text-white']:['bg-white','border-gray-200','text-gray-600','hover:border-verde']));
  });
}
