// db.js — Pool de conexiones a MySQL
// Un pool reutiliza conexiones abiertas en lugar de crear una nueva
// por cada petición, lo que mejora mucho el rendimiento.
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'loozanito_store',
  waitForConnections: true,  // esperar si todas las conexiones están ocupadas
  connectionLimit:    10,    // máximo 10 conexiones simultáneas
  queueLimit:         0,     // cola de espera ilimitada
  charset:            'utf8mb4'
});

// Probar la conexión al iniciar el servidor
pool.getConnection()
  .then(conn => { console.log('✅ MySQL conectado correctamente'); conn.release(); })
  .catch(err  => console.error('❌ Error al conectar MySQL:', err.message));

module.exports = pool;
