// Coordinated simulate -> sign -> broadcast flow used by Send/Staking views.

import { buildCallOp, signOp, type SubmitOptions } from "./ops.js";
import { Rpc } from "./rpc.js";
import * as wallet from "./wallet.js";
import { toast } from "./toast.js";
import { t } from "./i18n.js";
import type { ContractCall } from "./staking.js";

export interface SimResult {
  success: boolean;
  gas_used: number;
  error: string | null;
}

export interface SubmitResult {
  accepted: boolean;
  error: string | null;
}

export async function simulate(
  rpc: Rpc,
  target: string,
  call: ContractCall,
  opts: SubmitOptions = {},
): Promise<SimResult> {
  const s = wallet.signer();
  if (!s) throw new Error(t("common.sign_to_continue"));
  const op = await buildCallOp(rpc, s, target, call, opts);
  const signed = await signOp(s, op);
  const raw = (await rpc.client.simulateOperation(signed)) as unknown as {
    success: boolean;
    error: string | null;
    gas_used: number;
  };
  return raw;
}

export async function submit(
  rpc: Rpc,
  target: string,
  call: ContractCall,
  opts: SubmitOptions = {},
): Promise<SubmitResult> {
  const s = wallet.signer();
  if (!s) throw new Error(t("common.sign_to_continue"));
  const op = await buildCallOp(rpc, s, target, call, opts);
  const signed = await signOp(s, op);
  const raw = (await rpc.client.submitOperation(signed)) as unknown as SubmitResult;
  if (raw.accepted) {
    toast(t("toast.signed"), "ok");
  } else {
    toast(raw.error ?? t("common.error"), "error");
  }
  return raw;
}
