// Wallet / signer manager — seed-based signing (memory-only) + watch mode.
// Seeds are NEVER persisted; they live only in this module's closure until
// the user locks, refreshes, or the idle timer fires.

import { deriveSigner, type Signer } from "./ops.js";
import * as store from "./store.js";
import { toast } from "./toast.js";
import { t } from "./i18n.js";

type Listener = () => void;

export type ConnectionMode = "none" | "watch" | "sign";

interface State {
  mode: ConnectionMode;
  accountId: string | null;
  signer: Signer | null;
}

const state: State = { mode: "none", accountId: null, signer: null };
const listeners = new Set<Listener>();
let lockTimer: number | null = null;
let lastActivity = Date.now();

function notify() {
  for (const l of [...listeners]) l();
}

export function onChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function mode(): ConnectionMode {
  return state.mode;
}
export function accountId(): string | null {
  return state.accountId;
}
export function signer(): Signer | null {
  return state.signer;
}
export function canSign(): boolean {
  return state.mode === "sign" && state.signer !== null;
}

export async function unlockWithSeed(seedHex: string): Promise<void> {
  const clean = seedHex.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(clean)) throw new Error(t("error.invalid_seed"));
  const s = await deriveSigner(clean);
  state.signer = s;
  state.accountId = s.accountId;
  state.mode = "sign";
  lastActivity = Date.now();
  scheduleAutoLock();
  notify();
}

export function watchAddress(addr: string) {
  const clean = addr.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(clean)) throw new Error(t("error.invalid_addr"));
  state.signer = null;
  state.accountId = clean;
  state.mode = "watch";
  store.set("lastWatchedAccount", clean);
  notify();
}

export function lock(quiet = false) {
  const wasSigning = state.mode === "sign";
  state.signer = null;
  if (state.mode === "sign") state.mode = "none";
  if (lockTimer !== null) {
    clearTimeout(lockTimer);
    lockTimer = null;
  }
  if (wasSigning && !quiet) toast(t("toast.locked"), "info");
  notify();
}

export function disconnect() {
  state.signer = null;
  state.accountId = null;
  state.mode = "none";
  if (lockTimer !== null) {
    clearTimeout(lockTimer);
    lockTimer = null;
  }
  notify();
}

function scheduleAutoLock() {
  if (lockTimer !== null) clearTimeout(lockTimer);
  const mins = store.get("autoLockMinutes");
  if (mins <= 0) return;
  const check = () => {
    const idle = Date.now() - lastActivity;
    const limit = mins * 60_000;
    if (idle >= limit) {
      lock();
    } else {
      lockTimer = window.setTimeout(check, Math.max(15_000, limit - idle));
    }
  };
  lockTimer = window.setTimeout(check, mins * 60_000);
}

export function touch() {
  lastActivity = Date.now();
}

export function initAutoLockActivity() {
  const bump = () => touch();
  for (const ev of ["click", "keydown", "pointermove", "visibilitychange"]) {
    window.addEventListener(ev, bump, { passive: true });
  }
}

export function initFromStorage() {
  const w = store.get("lastWatchedAccount");
  if (w && /^[0-9a-f]{64}$/.test(w)) {
    state.accountId = w;
    state.mode = "watch";
  }
}
