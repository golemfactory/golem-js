FROM alpine:latest

RUN apk update \
 && apk add netcat-openbsd \
 && rm -rf /var/cache/apk/*

WORKDIR /golem/work
