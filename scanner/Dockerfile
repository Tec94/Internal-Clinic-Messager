FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends clamav clamav-daemon ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.mjs clamd.conf entrypoint.sh ./
RUN chmod 0555 /app/entrypoint.sh

USER root
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
