// routes/products.js — CRUD completo de productos
// Usa el campo 'imgurl' según la estructura real de la BD
const router = require('express').Router();
const db     = require('../db');
const { requireAdmin } = require('../middlewares/auth');

// ── GET /api/productos ─────────────────────────────────────
// PÚBLICA. Devuelve productos activos con nombre de categoría.
// Acepta ?categoria=slug para filtrar por categoría.
router.get('/', async (req, res) => {
  try {
    const { categoria } = req.query;
    let sql = `
      SELECT
        p.id, p.nombre, p.precio, p.unidad,
        p.stock, p.stock_max, p.descripcion, p.imgurl,
        c.nombre AS categoria,
        c.emoji  AS categoria_emoji,
        c.slug   AS categoria_slug
      FROM productos p
      JOIN categorias c ON c.id = p.categoria_id
      WHERE p.activo = 1
    `;
    const params = [];
    if (categoria && categoria !== 'todos') {
      sql += ' AND c.slug = ?';
      params.push(categoria);
    }
    sql += ' ORDER BY c.nombre, p.nombre';
    const [rows] = await db.execute(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('GET /productos:', err);
    res.status(500).json({ ok: false, message: 'Error al obtener productos' });
  }
});

// ── GET /api/productos/admin ───────────────────────────────
// PRIVADA. Todos los productos incluyendo inactivos.
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, c.nombre AS categoria, c.emoji AS categoria_emoji, c.slug AS categoria_slug
      FROM productos p
      JOIN categorias c ON c.id = p.categoria_id
      ORDER BY c.nombre, p.nombre
    `);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('GET /productos/admin:', err);
    res.status(500).json({ ok: false, message: 'Error al obtener productos' });
  }
});

// ── GET /api/productos/categorias ─────────────────────────
// PÚBLICA. Lista todas las categorías.
router.get('/categorias', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM categorias ORDER BY nombre');
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error al obtener categorías' });
  }
});

// ── POST /api/productos ────────────────────────────────────
// PRIVADA. Crear un nuevo producto.
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nombre, imgurl, categoria_id, precio, unidad, stock, stock_max, descripcion } = req.body;
    if (!nombre || !precio || !categoria_id) {
      return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios (nombre, precio, categoría)' });
    }
    const [result] = await db.execute(
      `INSERT INTO productos (nombre, imgurl, categoria_id, precio, unidad, stock, stock_max, descripcion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, imgurl || '', categoria_id, precio, unidad || 'kg', stock || 0, stock_max || 200, descripcion || null]
    );
    res.status(201).json({ ok: true, id: result.insertId, message: 'Producto creado exitosamente' });
  } catch (err) {
    console.error('POST /productos:', err);
    res.status(500).json({ ok: false, message: 'Error al crear producto' });
  }
});

// ── PUT /api/productos/:id ────────────────────────────────
// PRIVADA. Actualiza solo los campos que llegan en el body.
// Así se puede actualizar solo el stock sin tocar el resto.
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Lista blanca de campos permitidos para actualizar
    const permitidos = ['nombre','imgurl','categoria_id','precio','unidad','stock','stock_max','descripcion','activo'];
    const fields = [], values = [];

    permitidos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        fields.push(`${campo} = ?`);
        // 'activo' convierte true/false a 1/0 para MySQL
        values.push(campo === 'activo' ? (req.body[campo] ? 1 : 0) : req.body[campo]);
      }
    });

    if (!fields.length) return res.status(400).json({ ok: false, message: 'Sin campos para actualizar' });
    values.push(id); // el ID va al final para el WHERE

    const [result] = await db.execute(
      `UPDATE productos SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    if (!result.affectedRows) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });
    res.json({ ok: true, message: 'Producto actualizado' });
  } catch (err) {
    console.error('PUT /productos/:id:', err);
    res.status(500).json({ ok: false, message: 'Error al actualizar producto' });
  }
});

// ── DELETE /api/productos/:id ─────────────────────────────
// PRIVADA. Soft delete: marca como inactivo (no borra de la BD)
// para preservar el historial de pedidos anteriores.
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await db.execute(
      'UPDATE productos SET activo = 0 WHERE id = ?',
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });
    res.json({ ok: true, message: 'Producto desactivado' });
  } catch (err) {
    console.error('DELETE /productos/:id:', err);
    res.status(500).json({ ok: false, message: 'Error al eliminar producto' });
  }
});

module.exports = router;
