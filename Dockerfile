# Stage 1 — Build du client React
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2 — Serveur Node.js + client buildé
FROM node:20-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

EXPOSE 3001
CMD ["node", "index.js"]
