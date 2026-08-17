# Imagen para correr la app en un servidor (Fly.io, Railway, Render, un VPS...).
FROM node:22-slim

# better-sqlite3 se compila al instalar
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencias del server
COPY package*.json ./
RUN npm ci --omit=dev

# Frontend: se compila adentro de la imagen
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client ./client
RUN cd client && npm run build

COPY server ./server

# La base vive en un disco aparte para que sobreviva a los deploys
ENV DATA_DIR=/data
VOLUME /data

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
