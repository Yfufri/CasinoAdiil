# Déploiement

```
Internet ──https──> reverse proxy (nginx + Let's Encrypt) ──http──> VM « docker » (Proxmox)
                    casino.yfufri.fr                                 conteneur casino, port 3001
```

L'app tourne dans un conteneur Docker sur la VM `docker` du serveur Proxmox.
Le reverse proxy termine le HTTPS et relaie vers le conteneur, WebSockets compris
(exemple de configuration : [`deploy/nginx-casino.conf`](deploy/nginx-casino.conf)).

## Première installation

```bash
git clone https://github.com/Yfufri/CasinoAdiil.git
cd CasinoAdiil
cp .env.example .env
# Dans .env : un JWT_SECRET long et aléatoire (ex. `openssl rand -hex 48`)
# et le mot de passe du compte admin créé au premier démarrage.
docker compose up -d --build
```

L'app répond alors sur `http://<serveur>:3001`.

## Mise à jour

```bash
git pull
docker compose up -d --build
```

## Données

La base SQLite est stockée dans le volume Docker `casino-data` (`/data/casino.db`
dans le conteneur) : elle survit aux mises à jour et aux redémarrages.

- Sauvegarde : `docker compose cp casino:/data/casino.db ./casino-$(date +%F).db`
- Repartir de zéro (avant un nouvel event) : `docker compose down -v`, puis `docker compose up -d`.
  Le compte admin est recréé à partir de `.env`.
