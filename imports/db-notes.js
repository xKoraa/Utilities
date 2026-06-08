const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.NOTES_DB_HOST || process.env.DB_HOST,
  user: process.env.NOTES_DB_USER || process.env.DB_USER,
  password: process.env.NOTES_DB_PASS || process.env.DB_PASS,
  database: process.env.NOTES_DB_NAME,
  port: process.env.NOTES_DB_PORT || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;