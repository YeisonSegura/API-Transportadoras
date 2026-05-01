require('dotenv').config();

module.exports = {
  // Servidor
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Base de datos
  DB_CONFIG: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'appbucaclinicos',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0
  },

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'bucaclinicos_secret_2025',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',

  // Seguridad
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10,

  // Firebase
//  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT || './firebase-service-account.json',
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT || './firebase-service-account.json',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // Timeouts
  SCRAPING_TIMEOUT: parseInt(process.env.SCRAPING_TIMEOUT) || 15000
};
