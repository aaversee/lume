# LUME

An end-to-end encrypted, anonymous messenger.

The server is a blind relay: it stores and forwards opaque encrypted blobs and
never sees plaintext, keys, or message content. All cryptography runs on the
client.

- **Identity** is an Ed25519 key pair derived from a BIP39 phrase. No phone
  number, no email, no password, no session.
- **Messages** use X3DH key agreement and a Double Ratchet, so every message is
  encrypted under its own key.
- **Keys** never leave the device. They are sealed in IndexedDB under a key
  derived from the user's PIN and held only in a module-scoped vault — never in
  application state.

## Stack

| | |
|---|---|
| Client | Next.js 16 (App Router) · React 19 · Tailwind · Zustand · TweetNaCl · PWA |
| Server | Express · `ws` · SQLite (`better-sqlite3`) |
| Crypto | X3DH · Double Ratchet · HKDF-SHA256 · XSalsa20-Poly1305 |
| Auth | Ed25519 request signatures |

TypeScript strict throughout.

## How it works

The cryptographic protocol — key agreement, the message ratchet, prekeys, and
safety numbers — is written up in [`docs/PROTOCOL.md`](docs/PROTOCOL.md).

## Security

If you find a vulnerability, please report it privately rather than opening a
public issue.

## Licence

This repository is **source-available for viewing only**, under the
[LUME Source-Available License 1.0](LICENSE). You may read and reference the
source, but running, copying, modifying, or distributing it requires a separate
written licence. This is not an open-source or free-software licence.

Third-party dependencies and their licences: [`LEGAL`](LEGAL).
