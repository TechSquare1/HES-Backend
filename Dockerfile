# HES backend - container image for Azure Container Apps
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only (uses package-lock.json)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App source (.env, node_modules and uploads are excluded via .dockerignore)
COPY . .

# Uploaded files live here; in Azure this folder is a mounted Azure Files share
RUN mkdir -p /app/uploads

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
