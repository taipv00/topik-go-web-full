# Frontend Dockerfile with hot reload support
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install dependencies
RUN yarn install

# Copy source code
COPY . .

# Expose frontend port
EXPOSE 3081

# Run Next.js in development mode with hot reload
CMD ["yarn", "dev", "--port", "3081"]
