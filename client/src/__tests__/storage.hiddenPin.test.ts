// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * SEC-20260621-009 — the hidden-chat PIN hash must never be persisted unencrypted.
 * saveSettings must fail closed when no master key is provided.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { clear, get, set } from 'idb-keyval';

import { saveSettings, loadSettings, deriveMasterKeyFromPin } from '@/crypto/storage';

const HIDDEN_CHAT_PIN_KEY = 'hidden_chat_pin';

beforeEach(async () => {
  await clear();
});

const base = {
  theme: 'light' as const,
  notifications: true,
  selfDestructDefault: null,
  hiddenChatsEnabled: true,
};

describe('saveSettings hidden PIN hardening (SEC-20260621-009)', () => {
  it('refuses to persist hiddenChatPinHash without a master key (no plaintext fallback)', async () => {
    await expect(saveSettings({ ...base, hiddenChatPinHash: 'legacy-plain-hash' })).rejects.toThrow();
    // Nothing was written that a pre-auth load could surface.
    expect((await loadSettings()).hiddenChatPinHash).toBeUndefined();
  });

  it('stores the hash encrypted when a master key is provided', async () => {
    const mk = await deriveMasterKeyFromPin('1234');
    await saveSettings({ ...base, hiddenChatPinHash: 'h' }, mk);
    expect((await loadSettings(mk)).hiddenChatPinHash).toBe('h');
    // Without the key it is not plaintext-readable.
    expect((await loadSettings()).hiddenChatPinHash).toBeUndefined();
  });
});

describe('loadSettings legacy plaintext hidden PIN (SEC-20260621-009)', () => {
  it('omits a legacy plaintext hash and does not migrate it when no master key is supplied', async () => {
    // Simulate a legacy install: a raw plaintext hash string at rest.
    await set(HIDDEN_CHAT_PIN_KEY, 'legacy-plain-hash');

    const settings = await loadSettings();

    // Pre-auth read must never surface the legacy hash...
    expect(settings.hiddenChatPinHash).toBeUndefined();
    // ...and must leave it untouched (still a string, not migrated/encrypted).
    expect(await get(HIDDEN_CHAT_PIN_KEY)).toBe('legacy-plain-hash');
  });

  it('migrates and returns a legacy plaintext hash only when a master key is supplied', async () => {
    await set(HIDDEN_CHAT_PIN_KEY, 'legacy-plain-hash');
    const mk = await deriveMasterKeyFromPin('1234');

    const settings = await loadSettings(mk);

    // Authenticated read returns the hash...
    expect(settings.hiddenChatPinHash).toBe('legacy-plain-hash');
    // ...and the at-rest value is now encrypted (v2 object), no longer plaintext.
    const stored = await get(HIDDEN_CHAT_PIN_KEY);
    expect(typeof stored).toBe('object');
    expect((stored as { v?: number }).v).toBe(2);
    // A subsequent pre-auth read still cannot recover it.
    expect((await loadSettings()).hiddenChatPinHash).toBeUndefined();
  });
});
