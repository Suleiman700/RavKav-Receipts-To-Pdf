FROM node:14

LABEL description="Gets Rav-Kav contracts into PDF, Use /ravkav_help in telegram bot"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3007

CMD ["node", "app.js"]

# docker rm ravkav_nodejs_3007
# docker build -t ravkav_nodejs_3007 .
# docker run -d -p 3007:3007 --name ravkav_nodejs_3007 ravkav_nodejs_3007