const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role, credits: user.credits } });
});

// Admin: créer un compte participant
router.post('/register', requireAdmin, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (exists) return res.status(409).json({ error: 'Nom d\'utilisateur déjà pris' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    "INSERT INTO users (username, password, role, credits) VALUES (?, ?, 'participant', 500)"
  ).run(username.trim(), hash);

  db.prepare("INSERT INTO credit_logs (user_id, delta, reason) VALUES (?, 500, 'Jetons de départ')").run(result.lastInsertRowid);

  const user = db.prepare('SELECT id, username, role, credits FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ user });
});

module.exports = router;
