// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

"use client";

import type { ReactNode } from "react";
import { useMessengerSync } from "@/hooks/useMessengerSync";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ShortcutsModal } from "@/components/modals";
import { useUIStore } from "@/stores";

/**
 * Shared layout for all authenticated routes (chats, chat/[id], settings).
 *
 * Running useMessengerSync here means the WebSocket connection, local-data
 * hydration, message/read handlers, and persistence subscriptions live ONCE per
 * session. Navigating between authenticated pages keeps this layout mounted, so
 * we no longer repeat getSession / IndexedDB reloads / handler churn on every
 * route change (the previous behaviour when the hook was mounted per page).
 *
 * There is deliberately no template.tsx wrapper: a template re-mounts and
 * re-animates this entire subtree on every navigation, which read as the whole
 * screen reloading. Entrance motion belongs on the content blocks themselves.
 */
export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  useMessengerSync();
  const { isHelpOpen, closeHelp } = useKeyboardShortcuts();
  const locale = useUIStore((s) => s.locale);

  return (
    <div className="h-full min-h-0">
      {/*
        Components read strings through a module-level `t`, so changing the
        locale does not by itself re-render them. Keying on it remounts the
        subtree — cheap, and it happens at most once in a session. The key sits
        here rather than on the layout so useMessengerSync above keeps its
        WebSocket instead of reconnecting on a language change.
      */}
      <div key={locale} className="h-full min-h-0">
        {children}
      </div>
      <ShortcutsModal isOpen={isHelpOpen} onClose={closeHelp} />
    </div>
  );
}
