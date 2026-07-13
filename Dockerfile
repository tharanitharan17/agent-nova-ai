FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci
COPY frontend ./frontend
ARG VITE_API_URL
ARG VITE_REQUEST_TIMEOUT_MS
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_REQUEST_TIMEOUT_MS=$VITE_REQUEST_TIMEOUT_MS
RUN npm run build --workspace=frontend

FROM caddy:2-alpine
WORKDIR /app
COPY Caddyfile ./Caddyfile
COPY --from=build /app/frontend/dist ./dist
EXPOSE 8080
CMD ["caddy", "run", "--config", "/app/Caddyfile", "--adapter", "caddyfile"]
