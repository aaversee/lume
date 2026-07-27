# Running LUME locally

Node.js 22 — the version CI builds against (`.github/workflows/ci.yml`).

## First run

```bash
cd server && npm install
cd ../client && npm install
```

Both halves need environment files. Copy the examples and edit:

```bash
cp server/.env.example server/.env
cp client/.env.local.example client/.env.local
```

**The server exits rather than start with a bad `WS_JWT_SECRET`.** That refusal is deliberate — a messenger booting with a weak signing secret is worse than one that does not boot. It rejects four cases, not just a missing value (`server/src/utils/validateSecret.ts`):

- missing
- shorter than 32 bytes
- a known placeholder from the example file
- too few distinct characters to be plausibly random

So `WS_JWT_SECRET=secret` fails as surely as leaving it blank. Generate a real one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Starting

Two terminals:

```bash
cd server && npm run dev     # http://localhost:3001, WebSocket at /ws
cd client && npm run dev     # http://localhost:3000
```

The client reads `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` at build time, so changing them needs a restart, not a refresh.

The server creates `server/data/messenger.db` on first start (SQLite, WAL mode). It is gitignored. Deleting it resets server state — clients re-bind their identity on next unlock and keep working, which is the point of the client-authoritative design.

## Checks

```bash
npm run check:i18n    # unused keys, missing keys, locale drift
npm run check:css     # design tokens referenced but never defined
cd server && npm run type-check && npm run lint && npx vitest run
cd client && npx tsc --noEmit && npm run lint && npx vitest run
npx playwright test                                    # e2e (from repo root; config is not in client/)
```

All of these run in CI. Run the ones your change touches before pushing.

The three `check:*` scripts exist because each catches a failure the compiler
cannot see: two documents drifting apart, a catalogue key that outlived its
component, a `var(--token)` that resolves to nothing. Every one of them was
written after that exact failure had already happened here.

## If a command fails with a lock

`EBUSY`, `EACCES`, `EPERM`, `EADDRINUSE`, or "file in use" means a process is
holding the file or port — usually a dev server still running. **Stop and close
it.** Retrying produces the same failure and nothing else.

Running `next build` while `next dev` is up rewrites `client/next-env.d.ts`.
That file is generated; revert it rather than committing the change.

## Environment variables

Server (`server/.env`)

| Variable | Purpose |
|---|---|
| `WS_JWT_SECRET` | Signs WebSocket tickets. Required; long and random. |
| `NODE_ENV` | `development` relaxes the WebSocket Origin check. Never set it to `development` in production. |
| `PORT`, `HOST` | Listen address. |
| `CLIENT_ORIGIN` | Allowed browser origin. |
| `TRUST_PROXY`, `WS_TRUST_PROXY` | Set when running behind a reverse proxy so client IPs — and therefore rate limits — are read correctly. |
| `JSON_LIMIT`, `WS_MAX_PAYLOAD_BYTES` | Request and frame size caps. |
| `LOG_HTTP`, `LOG_SECURITY` | Log verbosity. Neither logs message content. |

Client (`client/.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Server base URL. |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL. |

Both client variables are `NEXT_PUBLIC_`, meaning they are compiled into the
bundle and visible to anyone. Nothing secret belongs there.

## Related

- [`PROTOCOL.md`](PROTOCOL.md) — the cryptographic protocol.
- [`deploy-docker.md`](deploy-docker.md) — self-hosting with Compose.
- [`deploy-vercel-render.md`](deploy-vercel-render.md) — the hosted setup.
