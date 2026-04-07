const express = require('express');
const db = require('../db');

const router = express.Router();

// Stats publiques pour la page d'accueil
router.get('/', (req, res) => {
  // Leaderboard
  const leaderboard = db.prepare(
    "SELECT id, username, credits FROM users WHERE role='participant' ORDER BY credits DESC LIMIT 20"
  ).all();

  // P&L casino roulette (somme des casino_delta)
  const rouletteRow = db.prepare(
    "SELECT COALESCE(SUM(casino_delta), 0) as total FROM roulette_games WHERE status = 'closed'"
  ).get();

  // Total échanges virtuel→physique approuvés (jetons physiques en circulation)
  const physicalOut = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM exchange_requests WHERE direction='to_physical' AND status='approved'"
  ).get();
  const physicalIn = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM exchange_requests WHERE direction='to_virtual' AND status='approved'"
  ).get();

  const physicalCirculation = physicalOut.total - physicalIn.total;

  // Total crédits en jeu (somme des crédits de tous les participants)
  const totalCredits = db.prepare(
    "SELECT COALESCE(SUM(credits), 0) as total FROM users WHERE role='participant'"
  ).get();

  // Nombre de parties roulette jouées
  const rouletteGames = db.prepare(
    "SELECT COUNT(*) as count FROM roulette_games WHERE status='closed'"
  ).get();

  // Hot/cold numbers (30 dernières parties)
  const hotCold = db.prepare(`
    SELECT result_number, COUNT(*) as count
    FROM roulette_games
    WHERE status = 'closed' AND result_number IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  // Agrégation par numéro
  const numberCounts = {};
  for (let i = 0; i <= 36; i++) numberCounts[i] = 0;
  hotCold.forEach(row => { numberCounts[row.result_number] = (numberCounts[row.result_number] || 0) + row.count; });

  // Derniers résultats roulette (20 derniers)
  const lastResults = db.prepare(`
    SELECT result_number, created_at FROM roulette_games
    WHERE status='closed' AND result_number IS NOT NULL
    ORDER BY closed_at DESC LIMIT 20
  `).all();

  res.json({
    leaderboard,
    casino: {
      roulettePnl: rouletteRow.total,
      physicalCirculation,
      totalCredits: totalCredits.total,
      rouletteGames: rouletteGames.count
    },
    hotColdNumbers: numberCounts,
    lastResults
  });
});

module.exports = router;
