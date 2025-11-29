FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

# Instala todas as dependências (inclui dev, pois o seed usa ts-node)
RUN npm ci

COPY . .

RUN npm run build \
  && npx prisma generate

CMD ["sh", "-c", "npm run build && npx prisma migrate deploy && npx prisma db seed && node dist/src/main.js"]

EXPOSE 3000
