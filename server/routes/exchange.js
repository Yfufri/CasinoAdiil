const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const MAX_TO_PHYSICAL = 250;

// Participant: créer une demande d'échange
router.post('/request', requireAuth, (req, res) => {
  const { direction, amount } = req.body;

  if (!['to_physical', 'to_virtual'].includes(direction)) {
    return res.status(400).json({ error: 'Direction invalide' });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Montant invalide' });
  }
  if (direction === 'to_physical' && amount > MAX_TO_PHYSICAL) {
    return res.status(400).json({ error: `Maximum ${MAX_TO_PHYSICAL} jetons par échange virtuel → physique` });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (direction === 'to_physical') {
    if (user.credits < amount) {
      return res.status(400).json({ error: 'Crédits insuffisants' });
    }
    // Réserver les crédits immédiatement
    db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(amount, user.id);
    db.prepare('INSERT INTO credit_logs (user_id, delta, reason, ref_id) VALUES (?, ?, ?, ?)').run(
      user.id, -amount, 'Réservation échange virtuel→physique (en attente)', null
    );
  }

  const result = db.prepare(
    'INSERT INTO exchange_requests (participant_id, direction, amount) VALUES (?, ?, ?)'
  ).run(req.user.id, direction, amount);

  // Mettre à jour la ref_id du log
  if (direction === 'to_physical') {
    db.prepare(
      "UPDATE credit_logs SET ref_id = ?, reason = 'Échange virtuel→physique (en attente)' WHERE user_id = ? AND reason LIKE 'Réservation%' ORDER BY id DESC LIMIT 1"
    ).run(result.lastInsertRowid, user.id);
  }

  const request = db.prepare('SELECT * FROM exchange_requests WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(request);
});

// Participant: ses demandes
router.get('/my', requireAuth, (req, res) => {
  const requests = db.prepare(
    'SELECT * FROM exchange_requests WHERE participant_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(req.user.id);
  res.json(requests);
});

// Participant: annuler une demande en attente (to_physical seulement)
router.delete('/:id', requireAuth, (req, res) => {
  const req_ = db.prepare(
    "SELECT * FROM exchange_requests WHERE id = ? AND participant_id = ? AND status = 'pending'"
  ).get(req.params.id, req.user.id);

  if (!req_) return res.status(404).json({ error: 'Demande introuvable ou déjà traitée' });

  db.prepare("UPDATE exchange_requests SET status = 'rejected' WHERE id = ?").run(req_.id);

  if (req_.direction === 'to_physical') {
    db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(req_.amount, req.user.id);
    db.prepare('INSERT INTO credit_logs (user_id, delta, reason, ref_id) VALUES (?, ?, ?, ?)').run(
      req.user.id, req_.amount, 'Annulation échange (remboursement)', req_.id
    );
  }

  res.json({ success: true });
});

// Admin: toutes les demandes en attente
router.get('/pending', requireAdmin, (req, res) => {
  const requests = db.prepare(`
    SELECT er.*, u.username, u.credits as user_credits
    FROM exchange_requests er
    JOIN users u ON u.id = er.participant_id
    WHERE er.status = 'pending'
    ORDER BY er.created_at ASC
  `).all();
  res.json(requests);
});

// Admin: historique de toutes les demandes
router.get('/all', requireAdmin, (req, res) => {
  const requests = db.prepare(`
    SELECT er.*, u.username, u.credits as user_credits
    FROM exchange_requests er
    JOIN users u ON u.id = er.participant_id
    ORDER BY er.created_at DESC
    LIMIT 100
  `).all();
  res.json(requests);
});

// Admin: traiter une demande (approve / reject)
router.patch('/:id', requireAdmin, (req, res) => {
  const { status, note } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  const exReq = db.prepare("SELECT * FROM exchange_requests WHERE id = ? AND status = 'pending'").get(req.params.id);
  if (!exReq) return res.status(404).json({ error: 'Demande introuvable ou déjà traitée' });

  const processExchange = db.transaction(() => {
    db.prepare(
      "UPDATE exchange_requests SET status = ?, admin_id = ?, note = ?, processed_at = datetime('now') WHERE id = ?"
    ).run(status, req.user.id, note || null, exReq.id);

    if (status === 'approved') {
      if (exReq.direction === 'to_physical') {
        // Crédits déjà déduits à la création — juste mettre à jour le log
        db.prepare(
          "UPDATE credit_logs SET reason = 'Échange virtuel→physique (approuvé)' WHERE ref_id = ? AND user_id = ?"
        ).run(exReq.id, exReq.participant_id);
      } else {
        // to_virtual: ajouter les crédits maintenant
        db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(exReq.amount, exReq.participant_id);
        db.prepare('INSERT INTO credit_logs (user_id, delta, reason, ref_id) VALUES (?, ?, ?, ?)').run(
          exReq.participant_id, exReq.amount, 'Échange physique→virtuel (approuvé)', exReq.id
        );
      }
    } else {
      // rejected
      if (exReq.direction === 'to_physical') {
        // Rembourser les crédits réservés
        db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(exReq.amount, exReq.participant_id);
        db.prepare('INSERT INTO credit_logs (user_id, delta, reason, ref_id) VALUES (?, ?, ?, ?)').run(
          exReq.participant_id, exReq.amount, 'Échange refusé (remboursement)', exReq.id
        );
      }
    }
  });

  processExchange();

  const updated = db.prepare(`
    SELECT er.*, u.username, u.credits as user_credits
    FROM exchange_requests er
    JOIN users u ON u.id = er.participant_id
    WHERE er.id = ?
  `).get(exReq.id);

  // Émettre via socket (géré dans index.js via io passé en paramètre)
  if (req.app.get('io')) {
    req.app.get('io').emit('exchange:update', updated);
    req.app.get('io').to(`user_${exReq.participant_id}`).emit('exchange:mine', updated);
  }

  res.json(updated);
});

module.exports = router;
