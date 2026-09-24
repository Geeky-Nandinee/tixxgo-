const app = require('./app');
const env = require('./config/env');
const db = require('./config/database');

async function startServer() {
  try {
    await db.initialize();

    const server = app.listen(env.PORT, () => {
      console.log(`=======================================================`);
      console.log(`  TIXXGO Travel Platform Backend Server Active         `);
      console.log(`  Listening on http://localhost:${env.PORT}           `);
      console.log(`  Environment: ${env.NODE_ENV}                         `);
      console.log(`=======================================================`);
    });

    return server;
  } catch (err) {
    console.error('Failed to start Tixxgo server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
