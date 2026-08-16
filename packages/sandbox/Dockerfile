FROM alpine:3.21
RUN apk add --no-cache bash git nodejs npm python3 make g++ curl
RUN adduser -D -u 1000 sandbox
WORKDIR /workspace
USER sandbox
