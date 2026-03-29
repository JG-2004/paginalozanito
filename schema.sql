-- ============================================================
-- La Canasta Verde — Schema completo
-- ============================================================
-- INSTRUCCIONES:
-- 1. Abrir phpMyAdmin
-- 2. Crear base de datos "canasta_verde" (si no existe)
-- 3. Seleccionarla → pestaña SQL → pegar todo esto → Ejecutar
-- ============================================================

CREATE DATABASE IF NOT EXISTS lozanito_store
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lozanito_store;

-- ── TABLA: categorias ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  emoji  VARCHAR(10) NOT NULL,
  slug   VARCHAR(50) NOT NULL UNIQUE
);

-- ── TABLA: productos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(100)  NOT NULL,
  categoria_id INT           NOT NULL,
  precio       DECIMAL(8,2)  NOT NULL,
  unidad       VARCHAR(20)   NOT NULL,
  stock        INT           NOT NULL DEFAULT 0,
  stock_max    INT           NOT NULL DEFAULT 200,
  activo       TINYINT(1)    NOT NULL DEFAULT 1,
  descripcion  TEXT,
  imgurl       VARCHAR(500)  NOT NULL DEFAULT '',
  created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
);

-- ── TABLA: pedidos ─────────────────────────────────────────
-- Guarda los datos completos del cliente y el pedido
CREATE TABLE IF NOT EXISTS pedidos (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nombre_cliente VARCHAR(100)  NOT NULL,   -- nombre del cliente
  apellido       VARCHAR(100)  DEFAULT NULL, -- apellido
  telefono       VARCHAR(20)   NOT NULL,   -- teléfono / WhatsApp
  direccion      VARCHAR(200)  DEFAULT NULL, -- dirección de entrega
  localidad      VARCHAR(100)  DEFAULT NULL, -- distrito / barrio
  notas          TEXT,                      -- notas adicionales
  total          DECIMAL(10,2) NOT NULL,
  estado         ENUM('pendiente','confirmado','entregado','cancelado') DEFAULT 'pendiente',
  created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ── TABLA: pedido_items ────────────────────────────────────
-- Detalle línea por línea de cada pedido
CREATE TABLE IF NOT EXISTS pedido_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id   INT           NOT NULL,
  producto_id INT           NOT NULL,
  nombre      VARCHAR(100)  NOT NULL,   -- nombre guardado al momento del pedido
  precio      DECIMAL(8,2)  NOT NULL,   -- precio guardado al momento del pedido
  cantidad    INT           NOT NULL,
  subtotal    DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (pedido_id)   REFERENCES pedidos(id)   ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
);

-- ── TABLA: admin_config ────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_config (
  clave VARCHAR(50) PRIMARY KEY,
  valor TEXT NOT NULL
);

-- ══════════════════════════════════════════════════════════
-- DATOS INICIALES
-- ══════════════════════════════════════════════════════════

-- Categorías
INSERT IGNORE INTO categorias (nombre, emoji, slug) VALUES
  ('Verduras',    '🥬', 'verduras'),
  ('Tubérculos',  '🥔', 'tuberculos'),
  ('Cítricos',    '🍋', 'citricos'),
  ('Otros',       '➕', 'otros');

-- Productos (comas dobles del SQL original corregidas)
INSERT IGNORE INTO productos (id, nombre, categoria_id, precio, unidad, stock, stock_max, descripcion, imgurl) VALUES
  (1,  'Camote morado',  2, 1.50, 'kg',     5,   200, 'Camote morado fresco',          'https://plazavea.vteximg.com.br/arquivos/ids/32281757-418-418/59640.jpg'),
  (2,  'Camote amarillo',2, 1.50, 'kg',     0,   200, 'Camote amarillo fresco',        'https://www.centraladomicilio.com/cdn/shop/products/camote_amarillo.jpg?v=1566172480'),
  (3,  'Camote blanco',  2, 1.50, 'kg',     0,   200, 'Camote blanco fresco',          'https://media.istockphoto.com/id/1087823864/photo/sweet-potato-on-white-background.jpg'),
  (4,  'Yuca',           2, 4.00, 'kg',     7,   200, 'Yuca suave',                    'https://arandanosdelhuerto.com/wp-content/uploads/2021/10/yuca.jpg'),
  (5,  'Tomate',         1, 2.00, 'kg',     7,   100, 'Tomates frescos de temporada',  'https://verduras.consumer.es/sites/verduras/files/styles/max_650x650/public/2025-05/tomate_0.webp'),
  (6,  'Cebolla',        1, 2.00, 'kg',     4,   100, 'Cebollas rojas tiernas',        'https://walmarthn.vtexassets.com/arquivos/ids/241497/Cebolla-Roja-Mazo-1-97.jpg'),
  (7,  'Ajo',            4, 2.50, '1/4 kg', 12,   80, 'Ajito para el aderezo',         'https://okdiario.com/img/vida-sana/2016/07/28/ajo.jpg'),
  (8,  'Zanahoria',      1, 0.90, 'kg',     0,    50, 'Zanahorias frescas',            'https://verduras.consumer.es/sites/verduras/files/styles/max_650x650/public/2025-05/zanahoria_0.webp'),
  (9,  'Limón',          3, 3.00, 'x25u',   200, 500, 'Limones frescos por 25 unidades','https://www.tvperu.gob.pe/sites/default/files/limon.jpg'),
  (10, 'Lenteja',        4, 3.00, 'kg',     10,   80, 'Lenteja para sopas y guisos',   'https://imgmedia.elpopular.pe/640x352/elpopular/original/2025/09/01/68b5c369d305e826a103b6a6.webp'),
  (11, 'Chileno',        4, 2.00, 'kg',     10,   80, 'Frijol chileno fresco',         'https://goldlandperu.com/assets/images/product_img1-17.jpg'),
  (12, 'Pepinillo',      1, 0.50, 'unidad',  9,   50, 'Pepinillos verdecitos frescos', 'https://www.frutosdelcampoperu.com/wp-content/uploads/2017/11/PEPINILLO-1.png'),
  (13, 'Maíz morado',   4, 3.00, 'kg',      9,   50, 'Maíz morado peruano',           'https://siagroexport.com/wp-content/uploads/2015/09/maiz-morado-purple-corn-zea-mays.jpg');

-- Configuración inicial de la tienda
INSERT IGNORE INTO admin_config (clave, valor) VALUES
  ('dia_venta',    '6'),           -- 6 = sábado (0=dom...6=sab)
  ('hora_inicio',  '08:00'),
  ('hora_fin',     '13:00'),
  ('telefono_wsp', '51999999999'), -- ← cambiar por tu número real
  ('nombre_tienda','La Canasta Verde');
