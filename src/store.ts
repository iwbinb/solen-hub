// Lightweight persisted state + event bus.

export type Theme = "dark" | "light" | "system";
export type Lang = "zh" | "en";

export interface AppState {
  rpcUrl: string;
  language: Lang;
  theme: Theme;
  autoLockMinutes: number;
  acknowledgedSeedWarning: boolean;
  lastWatchedAccount: string | null;
}

const DEFAULTS: AppState = {
  rpcUrl: "https://rpc.solenchain.io",
  language: "en",
  theme: "dark",
  autoLockMinutes: 30,
  acknowledgedSeedWarning: false,
  lastWatchedAccount: null,
};

const KEY = "solen-hub-state-v1";

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

let state: AppState = load();
const bus = new EventTarget();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function get<K extends keyof AppState>(k: K): AppState[K] {
  return state[k];
}

export function set<K extends keyof AppState>(k: K, v: AppState[K]) {
  if (state[k] === v) return;
  state[k] = v;
  save();
  bus.dispatchEvent(new CustomEvent("change", { detail: { key: k } }));
}

export function snapshot(): Readonly<AppState> {
  return { ...state };
}

export function onChange(cb: (key: keyof AppState) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent).detail.key);
  bus.addEventListener("change", h);
  return () => bus.removeEventListener("change", h);
}

export function reset() {
  state = { ...DEFAULTS };
  save();
  bus.dispatchEvent(new CustomEvent("change", { detail: { key: "rpcUrl" } }));
}
