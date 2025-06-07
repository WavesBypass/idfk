const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

// Register route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    await db.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
      [username, password, 'user']
    );
    res.status(200).send('Registered successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error registering user');
  }
});

// Submit form route
app.post('/submit-form', async (req, res) => {
  const { username, reason } = req.body;
  try {
    await db.query(
      'INSERT INTO join_requests (username, reason, status, submitted_at) VALUES ($1, $2, $3, NOW())',
      [username, reason, 'pending']
    );
    res.status(200).send('Form submitted');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error submitting form');
  }
});

// Show all pending forms (no auth for now)
app.get('/forms', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM join_requests WHERE status = 'pending' ORDER BY submitted_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error loading forms:', err);
    res.status(500).send('Error loading forms');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
