// UserOperation construction + signing (same pattern as the other Solen
// hackathon projects — see arena-pets/frontend/src/ops.ts for the rationale
// around manual multi-action ops and best-effort BLAKE3-of-JSON digest).

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { blake3 } from "@noble/hashes/blake3";
import type { UserOperation, Action } from "@solen/wallet-sdk";
import { Rpc } from "./rpc.js";
import { bytesToHex, hexToBytes, type ContractCall } from "./staking.js";

ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));

export interface Signer {
  readonly accountId: string;
  readonly seed: Uint8Array;
}

export interface SubmitOptions {
  value?: bigint;
  maxFee?: number;
}

export async function deriveSigner(seedHex: string): Promise<Signer> {
  const seed = new Uint8Array(hexToBytes(seedHex.trim()));
  if (seed.length !== 32) throw new Error("seed must be 32 bytes (64 hex)");
  const pub = await ed.getPublicKeyAsync(seed);
  return { accountId: bytesToHex(pub), seed };
}

export async function buildCallOp(
  rpc: Rpc,
  signer: Signer,
  target: string,
  call: ContractCall,
  opts: SubmitOptions = {},
): Promise<UserOperation> {
  const info = await rpc.getAccount(signer.accountId);
  const actions: Action[] = [];
  if (opts.value && opts.value > 0n) {
    actions.push({ Transfer: { to: target, amount: Number(opts.value) } });
  }
  actions.push({
    Call: { target, method: call.method, args: Array.from(call.args) },
  });
  return {
    sender: Array.from(hexToBytes(signer.accountId)),
    nonce: info.nonce,
    actions,
    max_fee: opts.maxFee ?? 10_000_000,
    signature: [],
  };
}

function digest(op: UserOperation): Uint8Array {
  const unsigned: UserOperation = { ...op, signature: [] };
  const encoded = new TextEncoder().encode(
    JSON.stringify(unsigned, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  );
  return blake3(encoded);
}

export async function signOp(
  signer: Signer,
  op: UserOperation,
): Promise<UserOperation> {
  const sig = await ed.signAsync(digest(op), signer.seed);
  return { ...op, signature: Array.from(sig) };
}

export async function submitCall(
  rpc: Rpc,
  signer: Signer,
  target: string,
  call: ContractCall,
  opts: SubmitOptions = {},
): Promise<{ accepted: boolean; error: string | null }> {
  const op = await buildCallOp(rpc, signer, target, call, opts);
  const signed = await signOp(signer, op);
  const raw = (await rpc.client.submitOperation(signed)) as unknown as {
    accepted: boolean;
    error: string | null;
  };
  return raw;
}

export async function simulateCall(
  rpc: Rpc,
  signer: Signer,
  target: string,
  call: ContractCall,
): Promise<{ success: boolean; error: string | null; gas_used: number }> {
  const op = await buildCallOp(rpc, signer, target, call);
  const signed = await signOp(signer, op);
  return (await rpc.client.simulateOperation(signed)) as unknown as {
    success: boolean;
    error: string | null;
    gas_used: number;
  };
}
