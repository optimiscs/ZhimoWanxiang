# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml first to leverage Docker cache
COPY package.json pnpm-lock.yaml ./

# Install app dependencies using pnpm
RUN pnpm install

# Copy the rest of the application code
# Use .dockerignore to exclude node_modules
COPY . .

# Create directories that might be needed
RUN mkdir -p /app/src/.umi
RUN mkdir -p /app/node_modules/.cache/logger

# Make port available
EXPOSE 3000

# Run the app when the container launches
CMD ["pnpm", "run", "dev"]
