// ============================================================
// js/api.js — Módulo centralizado de llamadas al backend
// ============================================================
// ⚠️  Para producción: cambiar esta URL por la URL real del backend
const API_URL = 'http://localhost:3001/api';

// ── Función base fetch ────────────────────────────────────────
const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem('admin_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'x-admin-token': token } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Error ${response.status}`);
  return data;
};

// ── Api global ────────────────────────────────────────────────
const Api = {
  getProductos:           (cat)        => apiFetch(`/productos${cat && cat !== 'todos' ? `?categoria=${cat}` : ''}`),
  getProductosAdmin:      ()           => apiFetch('/productos/admin'),
  getCategorias:          ()           => apiFetch('/productos/categorias'),
  crearProducto:          (data)       => apiFetch('/productos',       { method:'POST', body:JSON.stringify(data) }),
  actualizarProducto:     (id, data)   => apiFetch(`/productos/${id}`, { method:'PUT',  body:JSON.stringify(data) }),
  eliminarProducto:       (id)         => apiFetch(`/productos/${id}`, { method:'DELETE' }),
  crearPedido:            (data)       => apiFetch('/pedidos',         { method:'POST', body:JSON.stringify(data) }),
  getPedidos:             (estado)     => apiFetch(`/pedidos${estado ? `?estado=${estado}` : ''}`),
  getPedido:              (id)         => apiFetch(`/pedidos/${id}`),
  actualizarEstadoPedido: (id, estado) => apiFetch(`/pedidos/${id}`,   { method:'PUT',  body:JSON.stringify({ estado }) }),
  getConfig:              ()           => apiFetch('/config'),
  guardarConfig:          (data)       => apiFetch('/config',          { method:'PUT',  body:JSON.stringify(data) }),
  login:                  (password)   => apiFetch('/admin/login',     { method:'POST', body:JSON.stringify({ password }) }),
};

// ── Toast de notificaciones ───────────────────────────────────
function showToast(mensaje, tipo = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = toast.className.replace(/bg-\S+/g, '').trim();
  toast.classList.add(tipo === 'error' ? 'bg-red-500' : 'bg-verde');
  toast.textContent = mensaje;
  toast.classList.remove('translate-y-20');
  setTimeout(() => toast.classList.add('translate-y-20'), 2500);
}

// ── Renderizar imagen del producto ────────────────────────────
// Siempre usa imgurl. Si falla, muestra emoji de fallback.
function renderImg(imgurl, size = '3rem', clases = '') {
  if (imgurl && imgurl.startsWith('http')) {
    return `<img src="${imgurl}" alt="producto" loading="lazy"
      style="width:${size};height:${size};object-fit:cover;border-radius:8px;display:block;"
      class="${clases}"
      onerror="this.outerHTML='<div style=\'width:${size};height:${size};background:#d8f3dc;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.5rem\'>🥬</div>'"
    />`;
  }
  return `<div style="width:${size};height:${size};background:#d8f3dc;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.4rem">🥬</div>`;
}
