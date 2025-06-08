const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
  user: 'doadmin',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  database: 'defaultdb',
  password: 'AVNS_pmydiR8acsiQlbtVTQF', // keep this secret
  port: 25060,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'piget-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
}));

// Serve static files without /public in URL
app.use(express.static(path.join(__dirname, 'public')));

// Auto-create users table if not exists
async function createUsersTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      age INTEGER NOT NULL,
      discord VARCHAR(100) NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log('Users table is ready.');
  } catch (err) {
    console.error('Error creating users table:', err);
  }
}
createUsersTable();

// Register route
app.post('/register', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;
  if (!username || !password || !age || !discord || !reason) {
    return res.status(400).send('Missing required fields');
  }

  const ageInt = parseInt(age, 10);
  if (isNaN(ageInt)) {
    return res.status(400).send('Age must be a valid number');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (username, password, age, discord, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [username, hashedPassword, ageInt, discord, reason]
    );
    res.redirect('/login.html');
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).send('Registration failed');
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Missing username or password');
  }
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rowCount === 0) {
      return res.status(401).send('Invalid credentials');
    }
    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).send('Invalid credentials');
    }
    req.session.userId = user.id;
    res.redirect('/stats.html');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Login failed');
  }
});

// Middleware to redirect logged-in users from login page to stats.html
app.get('/login.html', (req, res, next) => {
  if (req.session.userId) {
    return res.redirect('/stats.html');
  }
  next();
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
