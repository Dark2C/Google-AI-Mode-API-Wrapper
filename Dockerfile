FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV HEADLESS=true
ENV USER_DATA_DIR=/app/data/sessions/google-profile
ENV BROWSER_LOCALE=it-IT
ENV BROWSER_TIMEZONE=Europe/Rome

EXPOSE 3000

CMD ["npm", "start"]
