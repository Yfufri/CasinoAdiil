const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Mon profil
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, role, credits, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(user);
});

// Mon historique de crédits
router.get('/me/logs', requireAuth, (req, res) => {
  const logs = db.prepare(
    'SELECT * FROM credit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);
  res.json(logs);
});

// Admin: liste tous les participants
router.get('/', requireAdmin, (req, res) => {
  const users = db.prepare(
    "SELECT id, username, role, credits, created_at FROM users WHERE role = 'participant' ORDER BY credits DESC"
  ).all();
  res.json(users);
});

// Admin: ajustement manuel de crédits
router.patch('/:id/credits', requireAdmin, (req, res) => {
  const { delta, reason } = req.body;
  if (typeof delta !== 'number' || !reason) return res.status(400).json({ error: 'Champs invalides' });

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(req.params.id, 'participant');
  if (!user) return res.status(404).json({ error: 'Participant introuvable' });

  const newCredits = user.credits + delta;
  if (newCredits < 0) return res.status(400).json({ error: 'Solde insuffisant' });

  db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(newCredits, user.id);
  db.prepare('INSERT INTO credit_logs (user_id, delta, reason) VALUES (?, ?, ?)').run(user.id, delta, reason);

  res.json({ id: user.id, credits: newCredits });
});

// Admin: reset mot de passe
router.patch('/:id/password', requireAdmin, (req, res) => {
  const bcrypt = require('bcryptjs');
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Mot de passe manquant' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('UPDATE users SET password = ? WHERE id = ? AND role = ?').run(hash, req.params.id, 'participant');
  if (info.changes === 0) return res.status(404).json({ error: 'Participant introuvable' });
  res.json({ success: true });
});

// Leaderboard public
router.get('/leaderboard', (req, res) => {
  const users = db.prepare(
    "SELECT id, username, credits FROM users WHERE role = 'participant' ORDER BY credits DESC LIMIT 20"
  ).all();
  res.json(users);
});

module.exports = router;
