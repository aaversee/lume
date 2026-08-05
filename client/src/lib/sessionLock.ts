// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * Per-contact lock around Double Ratchet session mutations.
 *
 * Every ratchet operation reads the stored session, advances it, and writes it
 * back, with network calls in between. Two of those overlapping on one contact
 * both start from the same state, and the later write silently discards the
 * other's advance:
 *
 *   - two sends produce two messages carrying the same message number, so the
 *     recipient can only ever open one of them and the other is lost with no
 *     error raised anywhere;
 *   - a send overlapping an inbound message throws away the DH ratchet step the
 *     receive just committed, which desynchronises the session for good.
 *
 * The second case needs no mistake by the user — only a message arriving while
 * one is being sent, which is ordinary conversation.
 *
 * This lives in its own module because correctness depends on **one** map being
 * shared by every path that touches a session. It used to be private to
 * useMessengerSync, which left the send path in the chat screen unprotected.
 */

const senderLocks = new Map<string, Promise<unknown>>();

export function withSenderLock<T>(
  senderId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = senderLocks.get(senderId) ?? Promise.resolve();
  // `fn` on both branches: a rejected predecessor must not skip this task.
  const next = prev.then(fn, fn);
  senderLocks.set(senderId, next);
  next
    .catch(() => {
      // Ownership of the error belongs to the caller awaiting `next`; this
      // handler exists only so the cleanup below never triggers an unhandled
      // rejection warning.
    })
    .finally(() => {
      if (senderLocks.get(senderId) === next) {
        senderLocks.delete(senderId);
      }
    });
  return next;
}
