const express = require("express");
const session = require("express-session");
const pg = require("pg");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL Connection
const pool = new pg.Pool({
  user: "doadmin",
  host: "db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com",
  database: "defaultdb",
  password: "AVNS_pmydiR8acsiQlbtVTQF",
  port: 25060,
  ssl: { rejectUnauthorized: false },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "pigetsecret", resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, "public")));

// Create tables if not exist
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS form_requests (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      reason TEXT,
      age INT,
      discord VARCHAR(255),
      status VARCHAR(10) DEFAULT 'pending'
    );
  `);
})();

// POST /submit-request
app.post("/submit-request", async (req, res) => {
  const { username, password, reason, age, discord } = req.body;
  if (!username || !password) return res.status(400).send("Missing fields");

  try {
    const userExists = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userExists.rows.length > 0) {
      return res.status(409).send("Username already taken");
    }

    const requestExists = await pool.query("SELECT * FROM form_requests WHERE username = $1", [username]);
    if (requestExists.rows.length > 0) {
      return res.status(409).send("Request already submitted");
    }

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO form_requests (username, password, reason, age, discord) VALUES ($1, $2, $3, $4, $5)`,
      [username, hashed, reason, age, discord]
    );

    res.status(200).send("Request submitted");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// GET /api/requests
app.get("/api/requests", async (req, res) => {
  try {
    const results = await pool.query("SELECT * FROM form_requests WHERE status = 'pending'");
    res.json(results.rows);
  } catch {
    res.status(500).send("Server error");
  }
});

// POST /api/requests/:id/approve
app.post("/api/requests/:id/approve", async (req, res) => {
  const { id } = req.params;
  try {
    const request = await pool.query("SELECT * FROM form_requests WHERE id = $1", [id]);
    if (request.rows.length === 0) return res.status(404).send("Request not found");

    const { username, password } = request.rows[0];
    await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, password]);
    await pool.query("UPDATE form_requests SET status = 'approved' WHERE id = $1", [id]);

    res.sendStatus(200);
  } catch {
    res.status(500).send("Server error");
  }
});

// POST /api/requests/:id/deny
app.post("/api/requests/:id/deny", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE form_requests SET status = 'denied' WHERE id = $1", [id]);
    res.sendStatus(200);
  } catch {
    res.status(500).send("Server error");
  }
});

// POST /login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.status(401).send("Invalid credentials");

    const valid = await bcrypt.compare(password, result.rows[0].password);
    if (!valid) return res.status(401).send("Invalid credentials");

    req.session.user = username;
    res.status(200).send("Success");
  } catch {
    res.status(500).send("Server error");
  }
});

// GET /check-session
app.get("/check-session", (req, res) => {
  if (req.session.user) return res.json({ loggedIn: true });
  res.json({ loggedIn: false });
});

// Start Server
app.listen(port, () => console.log(`Server running on port ${port}`));
