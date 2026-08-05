# Abuse and denial of service

What LUME already does, what it cannot do, and the one change that has to happen
at the same moment as putting a CDN in front of the relay.

---

## The honest split

There are two different problems and only one of them is solvable in this
repository.

**Application-layer abuse** — someone using the API faster or more often than a
real client would. This is code, and it is largely done: see the inventory
below.

**Volumetric attack** — someone saturating the network link. The packets are
dropped before Node is reached; no amount of Express middleware helps, because
the process never sees them. This needs capacity in front of the origin, which
means a CDN. Writing our own would be building a smaller version of something
that has to be bigger than the attacker, which is not a thing a small team wins.

So: keep hardening the first, buy the second.

---

## What is already in place

| Control | Where | Value |
|---|---|---|
| Per-endpoint rate limits | 16 limiters across the routes | varies per route |
| Public endpoint limit | `index.ts` | 60/min per address |
| WebSocket handshakes | `websocket/handler.ts` | 10/min per address |
| WebSocket sockets per address | `websocket/handler.ts` | 128 concurrent |
| WebSocket sockets per process | `websocket/handler.ts` | 5000 concurrent |
| WebSocket sockets per user | `websocket/handler.ts` | 5, oldest evicted |
| Inbound frame budget | `withinFrameBudget` | flooding closes the socket (1008) |
| WebSocket frame size | `WS_MAX_PAYLOAD_BYTES` | 64 KB |
| JSON body size | `JSON_LIMIT` | 8 MB |
| Header deadline | `HEADERS_TIMEOUT_MS` | 20s — the slow-loris control |
| Request deadline | `REQUEST_TIMEOUT_MS` | 120s |
| Table growth | TTL or cap on all nine tables | see below |

Every table is bounded, verified rather than assumed: `pending_messages` 30 days
plus a per-user cap, `files` a TTL with blobs deleted alongside the rows,
`request_signatures` 180 seconds, `invite_tokens` a TTL, one-time prekeys are
consumed on use, and the rest only grow through a user's own actions.

---

## Putting Cloudflare in front of Render

Free tier covers the volumetric case: L3/L4 absorption, a WAF, and challenges on
suspicious bursts. The client is already behind Vercel, which has its own edge —
the relay is the exposed one.

### The change that must not be forgotten

**Adding Cloudflare adds a proxy hop.** The chain becomes

```
client → Cloudflare → Render → app
```

Today `TRUST_PROXY=1` is correct, because Render alone is one hop. The moment
Cloudflare is in front, `X-Forwarded-For` carries one more entry and the server
reading "one hop in" lands on Cloudflare's address rather than the caller's.

Every one of the 16 rate limiters then buckets **all traffic on earth into one
key**. It will not error. It will not log anything unusual. It will look exactly
like a working limiter right up to the moment it rate-limits every user
simultaneously, which is a self-inflicted outage that looks like the attack it
was installed to stop.

So the two steps are one step:

```
TRUST_PROXY=2
```

set on Render **in the same change** as pointing DNS at Cloudflare. Do not do
one and then the other.

`server/src/utils/trustProxy.ts` refuses to boot on a value it cannot parse, so
a typo is a failed deploy rather than a silent fallback to zero.

### Verifying it afterwards

The check is that the server sees real client addresses, not Cloudflare's. With
`LOG_SECURITY=1`, make a request from a known address and confirm the limiter
key matches it. Two addresses hitting a limited endpoint should get independent
budgets; if one exhausts the other's, the hop count is too low.

### Order of work

1. Cloudflare account, add the domain, DNS moved (nameserver change, ~an hour to
   propagate).
2. Proxy mode on for the relay hostname (orange cloud), not DNS-only — DNS-only
   leaves the origin address published and the whole exercise pointless.
3. `TRUST_PROXY=2` on Render, same change.
4. Verify as above.
5. Only then consider WAF rules, which are tuning and can wait.

### Do not skip

Cloudflare hides the origin only if the origin is not reachable directly.
Render's `*.onrender.com` hostname stays public, so an attacker who finds it can
go around the CDN entirely. Restricting the origin to Cloudflare's published IP
ranges is what makes the protection real rather than decorative.

---

## Known gaps

**Backups.** SQLite on Render's disk has no backup configured. A lost disk means
lost undelivered messages and every user's server-side record — which, given the
client holds the keys and the identity, is survivable for the users but is still
an outage nobody can shorten. Undelivered messages are at most 30 days old, so
the exposure is bounded, but the user table is not reconstructible.

**Metadata.** The relay cannot read messages and does not try to. It does
necessarily see who talks to whom and when. That is the honest limit of the
design and worth stating publicly rather than being caught claiming otherwise.

**Account cost.** Registration is free and unmetered, which multiplies any
per-user limit. It is rate-limited per address; whether that is enough depends on
whether an attacker with many addresses is in the threat model.
