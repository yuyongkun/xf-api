FROM node:8-alpine

ARG NPM_CONFIG_REGISTRY
ARG NPM_CONFIG_DISTURL

WORKDIR /opt/fxshop-backend

## Add package.json individually to avoiding cache busted
COPY package.json .
## Install dependencies
RUN npm install && \
    rm -rf /root/.npm

## Copy source files
COPY . .

## expose default port
EXPOSE 9996

## Start the service
CMD node ./app
