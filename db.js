const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for self-signed certs on DigitalOcean
  }
});

pool.connect()
  .then(() => console.log('✅ Connected to PostgreSQL'))
  .catch(err => {
    console.error('❌ PostgreSQL connection error:', err.message);
    process.exit(1); // Stop the app if DB fails
  });

module.exports = pool;
