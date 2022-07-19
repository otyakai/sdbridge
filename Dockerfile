FROM node:18-alpine

WORKDIR /app/sdbridge
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn install

COPY tsconfig.json ./
COPY src ./src
RUN yarn tsc

CMD ["yarn", "node", "/app/sdbridge/dist"]