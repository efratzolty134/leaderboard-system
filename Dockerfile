# Use Node.js 18 Alpine (lightweight Linux)
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

COPY package*.json ./
RUN npm ci 

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Install TypeScript globally and build the app
RUN npm install -g typescript
RUN npm run build

# Create non-root user for security (Kubernetes best practice)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Change ownership of app directory to non-root user
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose the port your app runs on
EXPOSE 3000

# Health check for container monitoring (Kubernetes readiness probe)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Command to run when container starts
CMD ["node", "dist/server.js"]