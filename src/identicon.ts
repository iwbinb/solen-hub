// Deterministic SVG identicon derived from a hex address.
// 5x5 symmetric grid, 3 independent columns mirrored.

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function palette(h: number): [string, string] {
  const hue1 = h % 360;
  const hue2 = (hue1 + 40 + (h >>> 8) % 80) % 360;
  return [`hsl(${hue1} 70% 55%)`, `hsl(${hue2} 55% 40%)`];
}

export function identicon(addr: string, size = 36): string {
  const clean = addr.startsWith("0x") ? addr.slice(2) : addr;
  const h = hash32(clean);
  const [fg, bg] = palette(h);
  const cells: string[] = [];
  // 3 unique cols, 5 rows -> 15 bits from hash
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      const bit = (h >>> (y * 3 + x)) & 1;
      if (bit) {
        const mx = 4 - x;
        cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
        if (x !== mx) cells.push(`<rect x="${mx}" y="${y}" width="1" height="1"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5" width="${size}" height="${size}" style="border-radius:${size / 6}px;background:${bg}"><g fill="${fg}">${cells.join("")}</g></svg>`;
}
