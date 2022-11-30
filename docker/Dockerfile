# Use the base image with Node.js 8.11.3
FROM node:8.16.2

# Copy the current directory into the Docker image
COPY . /submission-scoring-processor

# Set working directory for future use
WORKDIR /submission-scoring-processor

# Install the dependencies from package.json
RUN npm install
CMD npm start
