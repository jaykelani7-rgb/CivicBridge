FROM node:20-alpine AS base

RUN apk add --no-cache openssl

WORKDIR /app

COPY prisma /app/prisma
COPY services/core-api/package*.json /app/services/core-api/

WORKDIR /app/services/core-api

RUN npm ci

ARG DATABASE_URL=postgresql://postgres:postgres@postgres:5432/resourcematch
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate --schema ../../prisma/schema.prisma

COPY services/core-api /app/services/core-api

FROM base AS dev

CMD ["npm", "run", "start:dev"]

FROM base AS build

RUN npm run build

FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

COPY prisma /app/prisma
COPY services/core-api/package*.json /app/services/core-api/

WORKDIR /app/services/core-api

RUN npm ci --omit=dev

ARG DATABASE_URL=postgresql://postgres:postgres@postgres:5432/resourcematch
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate --schema ../../prisma/schema.prisma

COPY --from=build /app/services/core-api/dist /app/services/core-api/dist

CMD ["npm", "run", "start"]
