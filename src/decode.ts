// Decode known contract calls (v1: staking system contract) into a
// human-readable summary for tx detail pages and signature previews.

import { STAKING_ADDRESS } from "./staking.js";
import { fmtSolen, shortHex } from "./format.js";
import { t } from "./i18n.js";

export interface DecodedCall {
  knownContract: string | null;
  method: string;
  summary: string;
  fields: Array<{ k: string; v: string }>;
}

function bytesToHex(b: number[] | Uint8Array): string {
  return Array.from(b, (x) => (x & 0xff).toString(16).padStart(2, "0")).join("");
}

function u128le(b: number[]): bigint {
  let v = 0n;
  for (let i = 15; i >= 0; i--) v = (v << 8n) | BigInt(b[i] & 0xff);
  return v;
}

export function decodeCall(target: string, method: string, args: number[]): DecodedCall {
  const clean = target.startsWith("0x") ? target.slice(2) : target;
  if (clean.toLowerCase() === STAKING_ADDRESS) {
    switch (method) {
      case "register": {
        const amt = u128le(args.slice(0, 16));
        return {
          knownContract: "Staking",
          method,
          summary: `Register validator with ${fmtSolen(amt)} SOLEN self-stake`,
          fields: [{ k: "Self-stake", v: `${fmtSolen(amt)} SOLEN` }],
        };
      }
      case "delegate":
      case "undelegate": {
        const v = bytesToHex(args.slice(0, 32));
        const amt = u128le(args.slice(32, 48));
        return {
          knownContract: "Staking",
          method,
          summary: `${method === "delegate" ? "Delegate" : "Undelegate"} ${fmtSolen(amt)} SOLEN ${method === "delegate" ? "to" : "from"} ${shortHex(v)}`,
          fields: [
            { k: "Validator", v },
            { k: t("common.amount"), v: `${fmtSolen(amt)} SOLEN` },
          ],
        };
      }
      case "withdraw":
        return {
          knownContract: "Staking",
          method,
          summary: "Withdraw all matured undelegations",
          fields: [],
        };
    }
  }
  return {
    knownContract: null,
    method,
    summary: `${method}(0x${bytesToHex(args).slice(0, 32)}…)`,
    fields: [{ k: "args (hex)", v: bytesToHex(args) }],
  };
}
