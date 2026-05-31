const mysql = require('mysql2/promise');
const { getDbConfig } = require('./config');

let pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool(getDbConfig());
  }

  return pool;
}

async function query(sql, params = []) {
  const db = await getPool();
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = {
  getPool,
  query,
  closePool
};
