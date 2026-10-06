# Déploiement pour l'event

```
Internet ──https──> Raspberry Pi (Caddy, ports 80/443)  ──Tailscale──>  PC Windows (Docker, port 3001)
                    100.118.58.115                                       100.103.36.13
```

Le Pi sert de point d'entrée HTTPS (certificat automatique), le PC fait tourner l'app.

## 0. Vérifier la virtualisation sur le PC (nécessaire pour Docker)

Gestionnaire des tâches → onglet **Performance** → **Processeur** : la ligne *Virtualisation* doit être **Activé(e)**.
Ou en PowerShell : `systeminfo | findstr /i "virtualis hyper-v"`.

Si elle est désactivée : l'activer dans le BIOS (Intel VT-x / AMD SVM), puis `wsl --install` en admin et redémarrer.
Si ce n'est pas faisable à temps → voir **Plan B** en bas de page.

## 1. PC Windows — lancer l'app (Docker Desktop)

Prérequis : Docker Desktop démarré, Tailscale connecté.

```powershell
git clone https://github.com/Yfufri/CasinoAdiil.git
cd CasinoAdiil
git checkout claude/casino-app-reset-33sebu
copy .env.example .env
notepad .env        # mettre un JWT_SECRET long et aléatoire + le mot de passe admin
docker compose up -d --build
```

Ouvrir le port 3001 dans le pare-feu Windows (PowerShell **en admin**) :

```powershell
New-NetFirewallRule -DisplayName "Casino 3001" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

Test local : http://localhost:3001

## 2. DNS

Chez le registrar du domaine : un enregistrement **A** `casino.tondomaine.fr` → IP publique de la box
où le Pi a déjà les ports 80/443 redirigés.

## 3. Raspberry Pi — reverse proxy HTTPS (Caddy)

```bash
ssh yfufri@100.118.58.115
curl -s http://100.103.36.13:3001 | head -c 100   # doit afficher du HTML -> le Pi voit bien le PC
sudo apt install -y caddy
sudo nano /etc/caddy/Caddyfile   # coller deploy/Caddyfile en remplaçant casino.example.com
sudo systemctl reload caddy
```

Ouvrir https://casino.tondomaine.fr — c'est prêt.

> Si nginx/apache occupe déjà le 80/443 sur le Pi, ne pas installer Caddy : ajouter un vhost
> qui proxy vers `http://100.103.36.13:3001` **avec le support WebSocket** (en-têtes `Upgrade` / `Connection`),
> sinon la roulette ne se mettra pas à jour en temps réel.

## Commandes utiles (sur le PC)

| Action | Commande |
|---|---|
| Voir les logs | `docker compose logs -f` |
| Mettre à jour le code | `git pull && docker compose up -d --build` |
| Arrêter (données conservées) | `docker compose down` |
| **Remise à zéro complète** (joueurs, crédits, parties) | `docker compose down -v && docker compose up -d --build` |

La base SQLite est stockée dans le volume Docker `casino-data` : elle survit aux redémarrages et rebuilds,
seul `down -v` l'efface. Le compte admin est recréé depuis `.env` quand la base est vide.

## Plan B — sans Docker

L'app n'est qu'un serveur Node : il suffit de Node.js 20+.

**Sur le PC Windows** (PowerShell, depuis le dossier du projet) :

```powershell
cd client; npm install; npm run build; cd ..\server; npm install
$env:JWT_SECRET="une-longue-chaine-aleatoire"; $env:ADMIN_PASSWORD="ton-mdp"
node index.js
```

(+ la règle de pare-feu de l'étape 1 ; le Caddyfile du Pi ne change pas.)

**Ou directement sur le Pi** (plus besoin du PC) :

```bash
cd ~/CasinoAdiil/client && npm install && npm run build
cd ../server && npm install
JWT_SECRET=une-longue-chaine ADMIN_PASSWORD=ton-mdp node index.js
```

et dans le Caddyfile remplacer `100.103.36.13:3001` par `localhost:3001`.
Remise à zéro sans Docker : arrêter le serveur et supprimer `server/casino.db*`.
