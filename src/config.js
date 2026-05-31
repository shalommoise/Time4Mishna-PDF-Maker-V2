const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const REQUIRED_DB_ENV = ['DB_HOST', 'DB_USER', 'DB_NAME'];

function projectRoot() {
  return path.resolve(__dirname, '..');
}

function loadEnv() {
  const envPath = path.join(projectRoot(), '.env');
  const exists = fs.existsSync(envPath);

  if (exists) {
    dotenv.config({ path: envPath });
  }

  return { envPath, exists };
}

function getDbConfig() {
  const { envPath, exists } = loadEnv();

  if (!exists) {
    const error = new Error(
      `Missing .env file at ${envPath}. Copy .env.example to .env and fill in database credentials.`
    );
    error.code = 'MISSING_ENV';
    throw error;
  }

  const missing = REQUIRED_DB_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    const error = new Error(`Missing required database environment variables: ${missing.join(', ')}`);
    error.code = 'MISSING_ENV_VARS';
    throw error;
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5)
  };
}

module.exports = {
  projectRoot,
  loadEnv,
  getDbConfig
};
