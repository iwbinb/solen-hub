// Local-only address book. No network sync.

const KEY = "solen-hub-book-v1";

export type AddrKind = "mine" | "validator" | "other";

export interface AddrEntry {
  address: string;
  label: string;
  kind: AddrKind;
  note?: string;
  added: number;
}

function load(): AddrEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AddrEntry[]) : [];
  } catch {
    return [];
  }
}

function save(list: AddrEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function normalize(a: string): string {
  return (a.startsWith("0x") ? a.slice(2) : a).toLowerCase();
}

export function entries(): AddrEntry[] {
  return load().sort((a, b) => b.added - a.added);
}

export function upsert(e: Omit<AddrEntry, "added"> & { added?: number }) {
  const list = load();
  const a = normalize(e.address);
  const existing = list.findIndex((x) => normalize(x.address) === a);
  const entry: AddrEntry = {
    address: a,
    label: e.label,
    kind: e.kind,
    note: e.note,
    added: e.added ?? Date.now(),
  };
  if (existing >= 0) list[existing] = entry;
  else list.push(entry);
  save(list);
}

export function remove(addr: string) {
  const a = normalize(addr);
  save(load().filter((e) => normalize(e.address) !== a));
}

export function find(addr: string): AddrEntry | undefined {
  const a = normalize(addr);
  return load().find((e) => normalize(e.address) === a);
}

export function label(addr: string): string | undefined {
  return find(addr)?.label;
}
