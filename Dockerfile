FROM node:20-slim

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --production

COPY backend/index.js .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
