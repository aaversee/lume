# Self-hosting with Docker Compose

Runs both halves on one host. This is the deployment that keeps server state,
because the database lives on a named volume rather than an ephemeral disk.

## Setup

```bash
cp .env.docker.example .env
```

Generate a real `WS_JWT_SECRET` — the server refuses to start without one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then:

```bash
docker compose up -d --build
```

| Service | Default port | Override |
|---|---|---|
| `lume-client` | 3000 | `CLIENT_PORT` |
| `lume-server` | 3001 | `SERVER_PORT` |

The server has a healthcheck, so `docker compose ps` reports whether it is
actually serving rather than merely running.

## Data

SQLite lives on the `lume-data` volume and survives `docker compose down`.

```bash
docker compose down -v     # deletes the volume — server state is gone
```

Losing it is survivable but not free: clients re-bind their identity on next
unlock and conversations continue, but **undelivered messages and uploaded
files are lost**. Back up the volume if that matters to you.

## Behind a reverse proxy

Terminate TLS at the proxy and set:

```
TRUST_PROXY=1
WS_TRUST_PROXY=1
CLIENT_ORIGIN=https://your-domain
```

Without the two proxy flags every request appears to come from the proxy's own
address, so per-IP rate limiting collapses into one shared bucket. Set them only
when a proxy really is in front — setting them otherwise lets a client spoof its
own address through a forwarded header.

The proxy must pass WebSocket upgrades through to `/ws`.

## Updating

```bash
git pull
docker compose up -d --build
```

The volume is untouched by a rebuild.

## Related

- [`development.md`](development.md) — running without Docker.
- [`deploy-vercel-render.md`](deploy-vercel-render.md) — the hosted setup.
