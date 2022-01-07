# syntax=docker.io/docker/dockerfile:1.3@sha256:42399d4635eddd7a9b8a24be879d2f9a930d0ed040a61324cfdf59ef1357b3b2

FROM node:lts-alpine@sha256:fa2f00d08281d522aeeeeeab6b158548c7d0c25fc3b8025579583c87c04c4c6b

RUN mkdir -p /app
WORKDIR /app

RUN apk add python3 \
        make \
        g++ 

ADD . .

RUN echo $(ls -1 .)
RUN echo $(less Dockerfile)

WORKDIR ./relayer/spy_relayer

RUN --mount=type=cache,uid=1000,gid=1000,target=/home/node/.npm \
  npm ci

RUN --mount=type=cache,uid=1000,gid=1000,target=/home/node/.npm \
  npm run build

#TODO don't hardcode for tilt but accept env file
# RUN --mount=type=cache,uid=1000,gid=1000,target=/home/node/.npm \
#   npm run tilt_relay