const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

const db = require('./db');
const { JWT_SECRET } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const exchangeRoutes = require('./routes/exchange');
const { router: rouletteRoutes } = require('./routes/roulette');
const statsRoutes = require('./routes/stats');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

app.set('io', io);

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/roulette', rouletteRoutes);
app.use('/api/stats', statsRoutes);

// Servir le front en production
const DIST = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(DIST));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// Socket.io — authentification et rooms
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
    } catch {
      socket.user = null;
    }
  }
  next();
});

io.on('connection', (socket) => {
  if (socket.user) {
    socket.join(`user_${socket.user.id}`);
    if (socket.user.role === 'admin') socket.join('admins');
    console.log(`[WS] ${socket.user.username} connecté`);
  } else {
    console.log('[WS] Spectateur connecté');
  }

  socket.on('disconnect', () => {
    if (socket.user) console.log(`[WS] ${socket.user.username} déconnecté`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🎰 Casino Adiil - Serveur démarré sur http://localhost:${PORT}\n`);
});
