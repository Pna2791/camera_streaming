FROM node:18-alpine

WORKDIR /app

# Install ffmpeg for RTSP testing
RUN apk add --no-cache ffmpeg

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy server file and printers.json
COPY server.js ./
COPY printers.json ./

EXPOSE 3000

CMD ["node", "server.js"]

