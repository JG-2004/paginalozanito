// routes/orders.js — Gestión de pedidos con transacciones MySQL
// Incluye apellido, localidad y todos los datos del cliente
const router = require('express').Router();
const db     = require('../db');
const { requireAdmin } = require('../middlewares/auth');

// ── POST /api/pedidos ──────────────────────────────────────
// PÚBLICA. El cliente envía su pedido desde la tienda.
// Usa transacción para garantizar que el stock y el pedido
// se actualicen juntos o ninguno se actualice (atomicidad).
router.post('/', async (req, res) => {
  const conn = await db.getConnection(); // conexión dedicada para la transacción
  try {
    const { nombre_cliente, apellido, telefono, direccion, localidad, notas, items } = req.body;

    // Validar que lleguen los campos mínimos obligatorios
    if (!nombre_cliente || !telefono || !items?.length) {
      return res.status(400).json({ ok: false, message: 'Faltan datos del pedido' });
    }

    await conn.beginTransaction(); // ── INICIO DE TRANSACCIÓN ──

    let total = 0;
    const itemsValidados = [];

    // Verificar cada producto en la BD (nunca confiar en el precio del cliente)
    for (const item of items) {
      const { producto_id, cantidad } = item;
      if (!producto_id || !cantidad || cantidad < 1) {
        throw new Error('Ítem del pedido inválido');
      }

      // FOR UPDATE bloquea el registro durante la transacción para evitar
      // que dos pedidos simultáneos agoten el mismo stock
      const [rows] = await conn.execute(
        'SELECT id, nombre, precio, stock, activo FROM productos WHERE id = ? FOR UPDATE',
        [producto_id]
      );

      const prod = rows[0];
      if (!prod || !prod.activo)   throw new Error(`Producto no disponible`);
      if (prod.stock < cantidad)   throw new Error(`Stock insuficiente para "${prod.nombre}" (disponible: ${prod.stock})`);

      const subtotal = parseFloat(prod.precio) * cantidad;
      total += subtotal;
      itemsValidados.push({
        producto_id,
        nombre:   prod.nombre,
        precio:   prod.precio,
        cantidad,
        subtotal: subtotal.toFixed(2)
      });
    }

    // Insertar la cabecera del pedido con todos los datos del cliente
    const [pedidoResult] = await conn.execute(
      `INSERT INTO pedidos (nombre_cliente, apellido, telefono, direccion, localidad, notas, total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre_cliente, apellido || null, telefono, direccion || null, localidad || null, notas || null, total.toFixed(2)]
    );
    const pedidoId = pedidoResult.insertId;

    // Insertar cada ítem y descontar del stock en tiempo real
    for (const item of itemsValidados) {
      await conn.execute(
        `INSERT INTO pedido_items (pedido_id, producto_id, nombre, precio, cantidad, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pedidoId, item.producto_id, item.nombre, item.precio, item.cantidad, item.subtotal]
      );
      // Reducir el stock del producto
      await conn.execute(
        'UPDATE productos SET stock = stock - ? WHERE id = ?',
        [item.cantidad, item.producto_id]
      );
    }

    await conn.commit(); // ── CONFIRMAR TODOS LOS CAMBIOS ──

    res.status(201).json({
      ok:        true,
      pedido_id: pedidoId,
      total:     total.toFixed(2),
      message:   'Pedido creado exitosamente'
    });

  } catch (error) {
    await conn.rollback(); // ── REVERTIR si algo falló ──
    console.error('Error POST /pedidos:', error.message);
    const status = error.message.includes('Stock') || error.message.includes('disponible') ? 400 : 500;
    res.status(status).json({ ok: false, message: error.message });
  } finally {
    conn.release(); // siempre devolver la conexión al pool
  }
});

// ── GET /api/pedidos ───────────────────────────────────────
// PRIVADA. Lista pedidos con filtro opcional por estado.
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { estado } = req.query;
    let sql = `
      SELECT
        p.id, p.nombre_cliente, p.apellido, p.telefono,
        p.direccion, p.localidad, p.total, p.estado, p.created_at,
        COUNT(pi.id) AS cantidad_items
      FROM pedidos p
      LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
    `;
    const params = [];
    if (estado) { sql += ' WHERE p.estado = ?'; params.push(estado); }
    sql += ' GROUP BY p.id ORDER BY p.created_at DESC';
    const [rows] = await db.execute(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('GET /pedidos:', err);
    res.status(500).json({ ok: false, message: 'Error al obtener pedidos' });
  }
});

// ── GET /api/pedidos/:id ───────────────────────────────────
// PRIVADA. Detalle completo de un pedido con sus ítems.
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const [pedidos] = await db.execute('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
    if (!pedidos.length) return res.status(404).json({ ok: false, message: 'Pedido no encontrado' });

    // Traer los items con la imagen del producto
    const [items] = await db.execute(
      `SELECT pi.*, prod.imgurl
       FROM pedido_items pi
       LEFT JOIN productos prod ON prod.id = pi.producto_id
       WHERE pi.pedido_id = ?`,
      [req.params.id]
    );

    res.json({ ok: true, data: { ...pedidos[0], items } });
  } catch (err) {
    console.error('GET /pedidos/:id:', err);
    res.status(500).json({ ok: false, message: 'Error al obtener pedido' });
  }
});

// ── PUT /api/pedidos/:id ───────────────────────────────────
// PRIVADA. Cambiar el estado del pedido.
// Si se cancela, devuelve el stock a los productos afectados.
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { estado } = req.body;
    const validos = ['pendiente','confirmado','entregado','cancelado'];
    if (!validos.includes(estado)) {
      return res.status(400).json({ ok: false, message: 'Estado inválido' });
    }

    await db.execute('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, req.params.id]);

    // Si se cancela, devolver el stock descontado al momento del pedido
    if (estado === 'cancelado') {
      const [items] = await db.execute(
        'SELECT producto_id, cantidad FROM pedido_items WHERE pedido_id = ?',
        [req.params.id]
      );
      for (const item of items) {
        await db.execute(
          'UPDATE productos SET stock = stock + ? WHERE id = ?',
          [item.cantidad, item.producto_id]
        );
      }
    }

    res.json({ ok: true, message: `Pedido marcado como: ${estado}` });
  } catch (err) {
    console.error('PUT /pedidos/:id:', err);
    res.status(500).json({ ok: false, message: 'Error al actualizar pedido' });
  }
});

module.exports = router;
