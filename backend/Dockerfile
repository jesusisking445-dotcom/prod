FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache netcat-openbsd

COPY package*.json ./
RUN npm ci --only=production

COPY docker-entrypoint.sh ./
COPY src ./src
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

ENV NODE_ENV=production

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
