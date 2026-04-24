// ABI helpers for the Solen staking system contract.
//
// Address = 0xFF × 31 + 0x01 = 32 bytes.
// Methods:
//   register(amount[16])                         -- become a validator
//   delegate(validator[32] + amount[16])         -- delegate to a validator
//   undelegate(validator[32] + amount[16])       -- start unbonding
//   withdraw()                                   -- withdraw matured undelegations
//
// Each method is dispatched via Action::Call { target: STAKING_ADDRESS, method, args }.
// All integers are little-endian.

export const STAKING_ADDRESS = "ff".repeat(31) + "01";

export interface ContractCall {
  method: string;
  args: Uint8Array;
}

export function hexToBytes(h: string): Uint8Array {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  if (s.length % 2 !== 0) throw new Error("odd-length hex");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(s.substr(i * 2, 2), 16);
  }
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(n);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function u128le(v: bigint): Uint8Array {
  const out = new Uint8Array(16);
  const d = new DataView(out.buffer);
  d.setBigUint64(0, v & 0xffffffffffffffffn, true);
  d.setBigUint64(8, v >> 64n, true);
  return out;
}

export const stakingCalls = {
  register(amount: bigint): ContractCall {
    return { method: "register", args: u128le(amount) };
  },
  delegate(validatorHex: string, amount: bigint): ContractCall {
    const v = hexToBytes(validatorHex);
    if (v.length !== 32) throw new Error("validator must be 32 bytes (64 hex)");
    return { method: "delegate", args: concat(v, u128le(amount)) };
  },
  undelegate(validatorHex: string, amount: bigint): ContractCall {
    const v = hexToBytes(validatorHex);
    if (v.length !== 32) throw new Error("validator must be 32 bytes (64 hex)");
    return { method: "undelegate", args: concat(v, u128le(amount)) };
  },
  withdraw(): ContractCall {
    return { method: "withdraw", args: new Uint8Array() };
  },
};
