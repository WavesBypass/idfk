const express = require('express');
const path = require('path');
const db = require('./db');       // your existing connection
const session = require('express-session');

const app = express();
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: '…', resave: false, saveUninitialized: true }));

// 1) Auto-create table
db.query(`
  CREATE TABLE IF NOT EXISTS join_requests (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    age INTEGER NOT NULL,
    discord TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(console.error);

// 2) User submits request
app.post('/submit-request', async (req, res) => {
  const { username, age, discord, reason } = req.body;
  try {
    await db.query(
      `INSERT INTO join_requests (username, age, discord, reason)
       VALUES ($1,$2,$3,$4)`,
      [username, age, discord, reason]
    );
    // show a simple “pending” page or redirect back
    return res.send(`<p>Thanks! Your request is pending approval.</p><a href="/">Home</a>`);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error, try again later.");
  }
});

// 3) Middleware to protect admin (fill in your auth logic)
function isStaff(req, res, next) {
  if (req.session.user?.role === 'staff') return next();
  res.status(403).send("Forbidden");
}

// 4) Render forms.html with data
app.get('/forms.html', isStaff, async (req, res) => {
  const { rows: requests } = await db.query(
    `SELECT * FROM join_requests WHERE status='pending' ORDER BY submitted_at`
  );
  res.render(path.join(__dirname, 'public/forms.html'), { requests });
});

// 5) Approve or deny
app.post('/approve/:id', isStaff, async (req, res) => {
  const id = req.params.id;
  // create the real user
  const { rows } = await db.query(`SELECT username FROM join_requests WHERE id=$1`, [id]);
  await db.query(`INSERT INTO users (username) VALUES ($1)`, [rows[0].username]);
  await db.query(`UPDATE join_requests SET status='approved' WHERE id=$1`, [id]);
  res.redirect('/forms.html');
});

app.post('/deny/:id', isStaff, async (req, res) => {
  await db.query(`UPDATE join_requests SET status='denied' WHERE id=$1`, [req.params.id]);
  res.redirect('/forms.html');
});

app.listen(3000, () => console.log("Server listening on http://localhost:3000"));
