# Backend Dockerfile with hot reload support
FROM node:20-alpine

# Install ffmpeg for media processing
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install dependencies including nodemon for hot reload
RUN yarn install && yarn add -D nodemon

# Copy source code
COPY . .

# Expose backend port
EXPOSE 4201

# Use nodemon for hot reload
CMD ["npx", "nodemon", "--legacy-watch", "server.js"]
