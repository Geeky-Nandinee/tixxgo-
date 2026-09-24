require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || 'root',
  DB_NAME: process.env.DB_NAME || 'tixxgo_db',
  TIXXGO_SERVICE_FEE: 299,
  TIXXGO_DEFAULT_PROMO_DISCOUNT: 200,
  SUPPLIER_TIMEOUT_MS: parseInt(process.env.SUPPLIER_TIMEOUT_MS || '4000', 10),
};
