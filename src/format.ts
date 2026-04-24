// Formatting helpers for Solen base units, hex, time.

export const DECIMALS = 100_000_000n; // 1 SOLEN = 10^8 base units

export function fmtSolen(v: bigint | string | number, maxFrac = 4): string {
  const n = typeof v === "bigint" ? v : BigInt(v || 0);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / DECIMALS;
  let frac = (abs % DECIMALS).toString().padStart(8, "0").replace(/0+$/, "");
  if (maxFrac >= 0 && frac.length > maxFrac) frac = frac.slice(0, maxFrac);
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${frac ? `${w}.${frac}` : w}`;
}

export function parseSolen(s: string): bigint {
  const clean = s.trim();
  if (!clean) return 0n;
  const [whole, frac = ""] = clean.split(".");
  const fracPadded = (frac + "00000000").slice(0, 8);
  return BigInt(whole || "0") * DECIMALS + BigInt(fracPadded || "0");
}

export function shortHex(h: string, lead = 6, tail = 4): string {
  const clean = h?.startsWith?.("0x") ? h.slice(2) : (h ?? "");
  if (!clean) return "—";
  if (clean.length <= lead + tail + 1) return clean;
  return `${clean.slice(0, lead)}…${clean.slice(-tail)}`;
}

export function agoMs(ms: number, jn = "just now"): string {
  const diff = Date.now() - ms;
  if (diff < 2000) return jn;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
  return `${Math.floor(diff / 86400_000)}d`;
}

export function bpsPct(bps: number | string): string {
  const n = typeof bps === "number" ? bps : Number(bps);
  return `${(n / 100).toFixed(2)}%`;
}

export function fmtGas(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function fmtDuration(totalSecs: number): string {
  if (totalSecs < 90) return `${Math.round(totalSecs)} s`;
  if (totalSecs < 5400) return `${Math.round(totalSecs / 60)} min`;
  if (totalSecs < 86400) return `${(totalSecs / 3600).toFixed(1)} h`;
  return `${(totalSecs / 86400).toFixed(1)} d`;
}

export function isHex32(s: string): boolean {
  const clean = s.startsWith("0x") ? s.slice(2) : s;
  return /^[0-9a-fA-F]{64}$/.test(clean);
}

export function normalizeAddr(a: string): string {
  return (a.startsWith("0x") ? a.slice(2) : a).toLowerCase();
}
