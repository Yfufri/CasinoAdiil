# Casino Adiil — Installation

## Prérequis
- Node.js 18+ installé

## Installation (une seule fois)

```bash
# Depuis la racine du projet
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

## Développement (avec hot-reload)

```bash
npm run dev
```

- Frontend : http://localhost:5173
- Backend : http://localhost:3001

## Production (pour l'event)

```bash
# Build du frontend
cd client && npm run build && cd ..

# Démarrer le serveur (sert aussi le frontend buildé)
cd server && npm start
```

Le serveur écoute sur le port **3001**.
Ouvrez http://localhost:3001 dans votre navigateur.

## Comptes par défaut

| Utilisateur | Mot de passe | Rôle |
|---|---|---|
| admin | admin1234 | Admin |

Créez les comptes participants depuis `/admin/users`.

## Pages

| URL | Description |
|---|---|
| `/` | Accueil public (leaderboard + stats) |
| `/login` | Connexion |
| `/dashboard` | Tableau de bord participant |
| `/exchange` | Table d'échange (participant) |
| `/roulette` | Table roulette (participant) |
| `/roulette/display` | **Écran spectateur** (2e moniteur) |
| `/admin/exchange` | Gestion des échanges |
| `/admin/roulette` | Contrôle de la roulette |
| `/admin/users` | Gestion des joueurs |
