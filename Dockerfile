FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --chown=node:node --from=builder /app .
RUN npm ci --omit=dev
USER node
# Required: server.ts treats anything other than 'production' as dev mode and
# would try to import vite (a devDependency absent from this image).
ENV NODE_ENV=production
EXPOSE 3000
CMD ["dumb-init", "node", "--env-file-if-exists=.env", "--import=tsx", "server.ts"]
