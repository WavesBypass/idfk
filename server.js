const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const { pool, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set true only with HTTPS
}));

// Initialize DB table
initDB();

// Routes

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) return res.status(400).send('❌ Username and password required.');

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
    res.status(200).send('✅ Registered successfully. <a href="/login.html">Login here</a>');
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).send('❌ Username already taken. <a href="/register.html">Try again</a>');
    } else {
      console.error(err);
      res.status(500).send('❌ Server error. Please try again later.');
    }
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) return res.status(400).send('❌ Username and password required.');

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).send('❌ Invalid username or password. <a href="/login.html">Try again</a>');
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).send('❌ Invalid username or password. <a href="/login.html">Try again</a>');
    }

    req.session.user = { id: user.id, username: user.username };
    res.redirect('/dashboard.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Server error during login.');
  }
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('❌ You must be logged in. <a href="/login.html">Login</a>');
  }
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
