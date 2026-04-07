const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Numéros rouges de la roulette européenne
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getColor(n) {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

// Calcul du gain pour un type de mise
function calculatePayout(betType, betValue, resultNumber) {
  const color = getColor(resultNumber);
  const isEven = resultNumber !== 0 && resultNumber % 2 === 0;
  const isLow = resultNumber >= 1 && resultNumber <= 18;
  const dozen = resultNumber === 0 ? null : Math.ceil(resultNumber / 12);
  const column = resultNumber === 0 ? null : ((resultNumber - 1) % 3) + 1;

  switch (betType) {
    case 'straight': // numéro plein — 35:1
      return parseInt(betValue) === resultNumber ? 36 : 0;
    case 'color': // rouge/noir — 1:1
      if (resultNumber === 0) return 0;
      return betValue === color ? 2 : 0;
    case 'evenodd': // pair/impair — 1:1
      if (resultNumber === 0) return 0;
      return (betValue === 'even') === isEven ? 2 : 0;
    case 'lowhigh': // 1-18 / 19-36 — 1:1
      if (resultNumber === 0) return 0;
      return (betValue === 'low') === isLow ? 2 : 0;
    case 'dozen': // 1ère/2ème/3ème douzaine — 2:1
      if (resultNumber === 0) return 0;
      return parseInt(betValue) === dozen ? 3 : 0;
    case 'column': // colonne — 2:1
      if (resultNumber === 0) return 0;
      return parseInt(betValue) === column ? 3 : 0;
    case 'split': { // cheval (2 numéros) — 17:1
      const nums = betValue.split('-').map(Number);
      return nums.includes(resultNumber) ? 18 : 0;
    }
    case 'street': { // transversale (3 numéros) — 11:1
      const nums = betValue.split('-').map(Number);
      return nums.includes(resultNumber) ? 12 : 0;
    }
    case 'corner': { // carré (4 numéros) — 8:1
      const nums = betValue.split('-').map(Number);
      return nums.includes(resultNumber) ? 9 : 0;
    }
    case 'line': { // sixain (6 numéros) — 5:1
      const nums = betValue.split('-').map(Number);
      return nums.includes(resultNumber) ? 6 : 0;
    }
    default:
      return 0;
  }
}

// Obtenir la partie en cours (ou la dernière)
router.get('/current', (req, res) => {
  const game = db.prepare(
    "SELECT * FROM roulette_games WHERE status IN ('betting','spinning','result') ORDER BY id DESC LIMIT 1"
  ).get();
  if (!game) return res.json(null);

  const bets = db.prepare(`
    SELECT rb.*, u.username FROM roulette_bets rb
    JOIN users u ON u.id = rb.participant_id
    WHERE rb.game_id = ?
  `).all(game.id);

  res.json({ ...game, bets });
});

// Mes mises sur la partie en cours
router.get('/my-bets', requireAuth, (req, res) => {
  const game = db.prepare(
    "SELECT * FROM roulette_games WHERE status IN ('betting','spinning','result') ORDER BY id DESC LIMIT 1"
  ).get();
  if (!game) return res.json([]);

  const bets = db.prepare(
    'SELECT * FROM roulette_bets WHERE game_id = ? AND participant_id = ?'
  ).all(game.id, req.user.id);
  res.json(bets);
});

// Historique des parties
router.get('/history', (req, res) => {
  const games = db.prepare(
    "SELECT * FROM roulette_games WHERE status='closed' ORDER BY closed_at DESC LIMIT 30"
  ).all();
  res.json(games);
});

// Admin: créer une nouvelle partie
router.post('/game', requireAdmin, (req, res) => {
  const { mode } = req.body;
  if (!['emulated', 'physical'].includes(mode)) {
    return res.status(400).json({ error: 'Mode invalide' });
  }

  // Fermer toute partie en cours
  db.prepare(
    "UPDATE roulette_games SET status='closed', closed_at=datetime('now') WHERE status IN ('betting','spinning','result')"
  ).run();

  const result = db.prepare(
    "INSERT INTO roulette_games (status, mode) VALUES ('betting', ?)"
  ).run(mode);

  const game = db.prepare('SELECT * FROM roulette_games WHERE id = ?').get(result.lastInsertRowid);

  if (req.app.get('io')) {
    req.app.get('io').emit('roulette:state', { ...game, bets: [] });
  }

  res.status(201).json(game);
});

// Admin: changer le mode d'une partie
router.patch('/game/:id/mode', requireAdmin, (req, res) => {
  const { mode } = req.body;
  if (!['emulated', 'physical'].includes(mode)) {
    return res.status(400).json({ error: 'Mode invalide' });
  }

  const game = db.prepare("SELECT * FROM roulette_games WHERE id = ? AND status='betting'").get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Partie introuvable ou pas en phase de mise' });

  db.prepare('UPDATE roulette_games SET mode = ? WHERE id = ?').run(mode, game.id);
  const updated = db.prepare('SELECT * FROM roulette_games WHERE id = ?').get(game.id);

  if (req.app.get('io')) {
    const bets = db.prepare('SELECT rb.*, u.username FROM roulette_bets rb JOIN users u ON u.id=rb.participant_id WHERE rb.game_id=?').all(game.id);
    req.app.get('io').emit('roulette:state', { ...updated, bets });
  }

  res.json(updated);
});

// Admin: lancer le spin (passe en statut 'spinning')
router.post('/game/:id/spin', requireAdmin, (req, res) => {
  const game = db.prepare("SELECT * FROM roulette_games WHERE id = ? AND status='betting'").get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Partie introuvable ou pas en phase de mise' });

  let resultNumber = null;
  if (game.mode === 'emulated') {
    resultNumber = Math.floor(Math.random() * 37); // 0-36
  }

  db.prepare("UPDATE roulette_games SET status='spinning', result_number=? WHERE id=?").run(
    resultNumber, game.id
  );
  const spinning = db.prepare('SELECT * FROM roulette_games WHERE id = ?').get(game.id);

  if (req.app.get('io')) {
    // Envoyer le numéro pour animer la roue (mode émulé)
    req.app.get('io').emit('roulette:spinning', { gameId: game.id, resultNumber, mode: game.mode });
  }

  res.json(spinning);
});

// Admin: entrer le résultat (mode physique OU confirmation mode émulé)
router.post('/game/:id/result', requireAdmin, (req, res) => {
  const { resultNumber } = req.body;
  if (!Number.isInteger(resultNumber) || resultNumber < 0 || resultNumber > 36) {
    return res.status(400).json({ error: 'Numéro invalide (0-36)' });
  }

  const game = db.prepare("SELECT * FROM roulette_games WHERE id = ? AND status IN ('spinning','betting')").get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Partie introuvable' });

  // Calculer les gains
  const settleResult = db.transaction(() => {
    const bets = db.prepare('SELECT * FROM roulette_bets WHERE game_id = ?').all(game.id);

    let casinoDelta = 0;
    for (const bet of bets) {
      const multiplier = calculatePayout(bet.bet_type, bet.bet_value, resultNumber);
      const payout = bet.amount * multiplier;
      const won = payout > 0 ? 1 : 0;

      db.prepare('UPDATE roulette_bets SET payout=?, won=? WHERE id=?').run(payout, won, bet.id);

      if (payout > 0) {
        db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(payout, bet.participant_id);
        db.prepare('INSERT INTO credit_logs (user_id, delta, reason, ref_id) VALUES (?, ?, ?, ?)').run(
          bet.participant_id, payout, `Gain roulette (${resultNumber})`, game.id
        );
      }
      // Casino gagne le montant misé - ce qu'il redistribue
      casinoDelta += bet.amount - payout;
    }

    db.prepare(
      "UPDATE roulette_games SET status='result', result_number=?, casino_delta=?, closed_at=datetime('now') WHERE id=?"
    ).run(resultNumber, casinoDelta, game.id);

    return { resultNumber, casinoDelta, bets };
  });

  const settled = settleResult();

  // Récupérer la partie complète avec les bets mis à jour
  const updatedGame = db.prepare('SELECT * FROM roulette_games WHERE id = ?').get(game.id);
  const updatedBets = db.prepare(
    'SELECT rb.*, u.username FROM roulette_bets rb JOIN users u ON u.id=rb.participant_id WHERE rb.game_id=?'
  ).all(game.id);

  if (req.app.get('io')) {
    req.app.get('io').emit('roulette:result', {
      game: updatedGame,
      bets: updatedBets,
      resultNumber,
      color: getColor(resultNumber)
    });
    // Notifier chaque participant de son nouveau solde
    for (const bet of updatedBets) {
      const user = db.prepare('SELECT credits FROM users WHERE id=?').get(bet.participant_id);
      req.app.get('io').to(`user_${bet.participant_id}`).emit('credits:update', { credits: user.credits });
    }
  }

  res.json({ game: updatedGame, bets: updatedBets, resultNumber });
});

// Admin: fermer définitivement une partie (result → closed)
router.post('/game/:id/close', requireAdmin, (req, res) => {
  const game = db.prepare("SELECT * FROM roulette_games WHERE id = ? AND status='result'").get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Partie introuvable ou pas en phase résultat' });

  db.prepare("UPDATE roulette_games SET status='closed' WHERE id=?").run(game.id);
  if (req.app.get('io')) {
    req.app.get('io').emit('roulette:closed', { gameId: game.id });
  }
  res.json({ success: true });
});

// Participant: placer une mise
router.post('/bet', requireAuth, (req, res) => {
  const { betType, betValue, amount } = req.body;

  if (!betType || !betValue || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Paramètres invalides' });
  }

  const game = db.prepare("SELECT * FROM roulette_games WHERE status='betting' ORDER BY id DESC LIMIT 1").get();
  if (!game) return res.status(400).json({ error: 'Aucune partie en cours de mise' });

  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Compte introuvable, reconnecte-toi' });
  if (user.credits < amount) return res.status(400).json({ error: 'Crédits insuffisants' });

  const placeBet = db.transaction(() => {
    db.prepare('UPDATE users SET credits = credits - ? WHERE id=?').run(amount, user.id);
    db.prepare('INSERT INTO credit_logs (user_id, delta, reason, ref_id) VALUES (?, ?, ?, ?)').run(
      user.id, -amount, `Mise roulette (${betType}:${betValue})`, game.id
    );
    const r = db.prepare(
      'INSERT INTO roulette_bets (game_id, participant_id, bet_type, bet_value, amount) VALUES (?, ?, ?, ?, ?)'
    ).run(game.id, user.id, betType, betValue, amount);
    return r.lastInsertRowid;
  });

  const betId = placeBet();
  const bet = db.prepare('SELECT rb.*, u.username FROM roulette_bets rb JOIN users u ON u.id=rb.participant_id WHERE rb.id=?').get(betId);
  const newCredits = db.prepare('SELECT credits FROM users WHERE id=?').get(user.id).credits;

  if (req.app.get('io')) {
    req.app.get('io').emit('roulette:bet', bet);
    req.app.get('io').to(`user_${user.id}`).emit('credits:update', { credits: newCredits });
  }

  res.status(201).json({ bet, credits: newCredits });
});

// Participant: annuler la dernière mise (undo)
router.delete('/bet/:id', requireAuth, (req, res) => {
  const bet = db.prepare('SELECT * FROM roulette_bets WHERE id=? AND participant_id=?').get(req.params.id, req.user.id);
  if (!bet) return res.status(404).json({ error: 'Mise introuvable' });

  const game = db.prepare("SELECT * FROM roulette_games WHERE id=? AND status='betting'").get(bet.game_id);
  if (!game) return res.status(400).json({ error: 'Les mises sont fermées' });

  db.transaction(() => {
    db.prepare('DELETE FROM roulette_bets WHERE id=?').run(bet.id);
    db.prepare('UPDATE users SET credits = credits + ? WHERE id=?').run(bet.amount, req.user.id);
  })();

  const newCredits = db.prepare('SELECT credits FROM users WHERE id=?').get(req.user.id).credits;
  if (req.app.get('io')) {
    req.app.get('io').to(`user_${req.user.id}`).emit('credits:update', { credits: newCredits });
  }
  res.json({ credits: newCredits });
});

// Participant: effacer toutes ses mises du tour en cours (clear)
router.delete('/my-bets', requireAuth, (req, res) => {
  const game = db.prepare("SELECT * FROM roulette_games WHERE status='betting' ORDER BY id DESC LIMIT 1").get();
  if (!game) return res.status(400).json({ error: 'Aucune partie en cours' });

  const bets = db.prepare('SELECT * FROM roulette_bets WHERE game_id=? AND participant_id=?').all(game.id, req.user.id);
  const total = bets.reduce((s, b) => s + b.amount, 0);

  db.transaction(() => {
    db.prepare('DELETE FROM roulette_bets WHERE game_id=? AND participant_id=?').run(game.id, req.user.id);
    if (total > 0) db.prepare('UPDATE users SET credits = credits + ? WHERE id=?').run(total, req.user.id);
  })();

  const newCredits = db.prepare('SELECT credits FROM users WHERE id=?').get(req.user.id).credits;
  if (req.app.get('io')) {
    req.app.get('io').to(`user_${req.user.id}`).emit('credits:update', { credits: newCredits });
  }
  res.json({ credits: newCredits });
});

module.exports = { router, getColor };
