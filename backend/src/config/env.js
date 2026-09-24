require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || 'root',
  DB_NAME: process.env.DB_NAME || 'tixxgo_db',
  TIXXGO_SERVICE_FEE: parseInt(process.env.TIXXGO_SERVICE_FEE || '299', 10),
  TIXXGO_DEFAULT_PROMO_DISCOUNT: parseInt(process.env.TIXXGO_DEFAULT_PROMO_DISCOUNT || '200', 10),
  SUPPLIER_TIMEOUT_MS: parseInt(process.env.SUPPLIER_TIMEOUT_MS || '4000', 10),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
};

