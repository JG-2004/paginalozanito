// server.js — Servidor principal Express para La Canasta Verde
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');
const db      = require('./db');
const productosRouter  = require('./routes/products');
const pedidosRouter    = require('./routes/orders');
const { requireAdmin } = require('./middlewares/auth');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares globales ──────────────────────────────────────
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization','x-admin-token']
}));

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api/productos', productosRouter);
app.use('/api/pedidos',   pedidosRouter);

// ── POST /api/admin/login ─────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: 'Contraseña incorrecta' });
  }
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'secreto_dev', { expiresIn: '8h' });
  res.json({ ok: true, token });
});

// ── GET /api/config ───────────────────────────────────────────
app.get('/api/config', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT clave, valor FROM admin_config');
    const config = rows.reduce((acc, row) => ({ ...acc, [row.clave]: row.valor }), {});
    res.json({ ok: true, data: config });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error al obtener configuración' });
  }
});

// ── PUT /api/config ───────────────────────────────────────────
app.put('/api/config', requireAdmin, async (req, res) => {
  try {
    for (const [clave, valor] of Object.entries(req.body)) {
      await db.execute(
        'INSERT INTO admin_config (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?',
        [clave, valor, valor]
      );
    }
    res.json({ ok: true, message: 'Configuración guardada' });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error al guardar configuración' });
  }
});

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: '🥬 La Canasta Verde API funcionando', time: new Date() });
});

// ── Iniciar servidor ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📦 API:    http://localhost:${PORT}/api`);
  console.log(`🩺 Health: http://localhost:${PORT}/api/health\n`);
});
