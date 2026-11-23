# Builds the UI and the API, and ships one image that serves both.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci

COPY . .
RUN npx prisma generate --schema server/prisma/schema.prisma \
  && npm run build --workspace=web \
  && npm run build --workspace=server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV WEB_DIST=/app/web/dist

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/web/dist ./web/dist

EXPOSE 4000
# Migrations run on boot: the schema a release needs ships with that release.
CMD ["sh", "-c", "npx prisma migrate deploy --schema server/prisma/schema.prisma && node server/dist/src/main.js"]
