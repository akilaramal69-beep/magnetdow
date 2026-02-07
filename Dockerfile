# Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx tsc

# Production Stage
FROM node:18-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy built artifacts from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/run.js ./

# Create a volume for the captcha token
VOLUME /app/data

# Environment variables
ENV PORT=3000
ENV PIKPAK_USERNAME=""
ENV PIKPAK_PASSWORD=""

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "dist/backend/server.js"]
