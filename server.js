const express = require("express");
const session = require("express-session");
const pg = require("pg");
const path = require("path");
const bcrypt = require("bcrypt");
const app = express();

const PORT = process.env.PORT || 3000;

// DigitalOcean PostgreSQL config
const pool = new pg.Pool({
  user: "doadmin",
  host: "db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com",
  database: "defaultdb",
  password: "AVNS_pmydiR8acsiQlbtVTQF",
  port: 25060,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(session({
  secret: "supersecret",
  resave: false,
  saveUninitialized: false,
}));

// Auto-create tables
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS form_requests (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      discord TEXT NOT NULL,
      age INT,
      reason TEXT,
      approved BOOLEAN DEFAULT FALSE
    );
  `);
  console.log("✅ Tables checked/created");
})();

// Registration request
app.post("/submit-request", async (req, res) => {
  const { username, password, discord, age, reason } = req.body;

  if (!username || !password || !discord || !age || !reason) {
    return res.status(400).json({ error: "All fields required." });
  }

  try {
    const userExists = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const requestExists = await pool.query("SELECT * FROM form_requests WHERE username = $1", [username]);

    if (userExists.rowCount > 0 || requestExists.rowCount > 0) {
      return res.status(409).json({ error: "Username already exists or is pending approval." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO form_requests (username, password, discord, age, reason) VALUES ($1, $2, $3, $4, $5)`,
      [username, hashedPassword, discord, age, reason]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error submitting request:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// Approve/deny forms (basic GET for /forms.html and POST for action)
app.get("/api/requests", async (req, res) => {
  const results = await pool.query("SELECT * FROM form_requests WHERE approved = FALSE");
  res.json(results.rows);
});

app.post("/api/requests/:id/approve", async (req, res) => {
  const id = req.params.id;
  try {
    const { username, password } = (await pool.query("SELECT * FROM form_requests WHERE id = $1", [id])).rows[0];
    await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, password]);
    await pool.query("UPDATE form_requests SET approved = TRUE WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Approval failed." });
  }
});

app.post("/api/requests/:id/deny", async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM form_requests WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Denial failed." });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    req.session.user = user;
    res.json({ success: true });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// Session check (e.g., for redirecting logged-in users)
app.get("/check-auth", (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true });
  } else {
    res.json({ loggedIn: false });
  }
});

app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
