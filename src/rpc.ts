// JSON-RPC layer wrapping @solen/wallet-sdk's SolenClient plus raw calls
// for methods not exposed by v0.1.0 of the TS SDK.

import { SolenClient } from "@solen/wallet-sdk";

export interface ChainStatus {
  height: number;
  state_root: string;
  pending_ops: number;
  total_allocation: string;
  total_staked: string;
  total_circulation: string;
  config: {
    block_time_ms: number;
    min_validator_stake: string;
    unbonding_period_epochs: number;
    epoch_length: number;
    base_fee_per_gas: string;
    burn_rate_bps: number;
  };
}

export interface BlockInfo {
  height: number;
  epoch: number;
  parent_hash: string;
  state_root: string;
  transactions_root: string;
  receipts_root: string;
  proposer: string;
  timestamp_ms: number;
  tx_count: number;
  gas_used: number;
}

export interface AccountInfo {
  id: string;
  balance: string;
  nonce: number;
  code_hash: string;
  staked: string;
}

export interface ValidatorInfo {
  address: string;
  self_stake: string;
  total_delegated: string;
  total_stake: string;
  is_active: boolean;
  is_genesis: boolean;
  commission_bps: number;
}

export interface DelegationInfo {
  validator: string;
  amount: string;
}

export interface StakingInfo {
  total_delegated: string;
  delegations: DelegationInfo[];
  pending_undelegations: number;
}

export interface VestingInfo {
  schedules: Array<{
    start_ms: number;
    end_ms: number;
    total: string;
    released: string;
  }>;
}

export interface ProposalInfo {
  id: number;
  title?: string;
  description?: string;
  status: string;
  yes: string;
  no: string;
  abstain?: string;
  end_epoch?: number;
  proposer?: string;
}

export interface TxAction {
  Transfer?: { to: string; amount: number };
  Call?: { target: string; method: string; args: number[] };
}

export interface TxDetails {
  sender: string;
  nonce: number;
  actions: TxAction[];
  max_fee: number;
  signature: number[];
  hash?: string;
  gas_used?: number;
  status?: string;
}

export class Rpc {
  readonly url: string;
  readonly client: SolenClient;
  private nextId = 1;

  constructor(url: string) {
    this.url = url;
    this.client = new SolenClient({ rpcUrl: url });
  }

  async raw<T>(method: string, params: unknown[] = []): Promise<T> {
    const r = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as {
      result?: T;
      error?: { code: number; message: string };
    };
    if (j.error) throw new Error(`${method}: ${j.error.message}`);
    return j.result as T;
  }

  async supports(method: string): Promise<boolean> {
    try {
      await this.raw(method, []);
      return true;
    } catch (e) {
      const msg = String((e as Error).message || e);
      if (msg.includes("Method not found") || msg.includes("-32601")) return false;
      return true;
    }
  }

  chainStatus(): Promise<ChainStatus> {
    return this.raw("solen_chainStatus");
  }
  getLatestBlock(): Promise<BlockInfo> {
    return this.raw("solen_getLatestBlock");
  }
  getBlock(height: number): Promise<BlockInfo> {
    return this.raw("solen_getBlock", [height]);
  }
  getBlockTxs(height: number): Promise<TxDetails[]> {
    return this.raw("solen_getBlockTransactions", [height]);
  }
  getTransaction(hash: string): Promise<TxDetails> {
    return this.raw("solen_getTransaction", [hash]);
  }
  getAccount(id: string): Promise<AccountInfo> {
    return this.raw("solen_getAccount", [id]);
  }
  getBalance(id: string): Promise<string> {
    return this.raw("solen_getBalance", [id]);
  }
  getValidators(): Promise<ValidatorInfo[]> {
    return this.raw("solen_getValidators");
  }
  getStakingInfo(id: string): Promise<StakingInfo> {
    return this.raw("solen_getStakingInfo", [id]);
  }
  getVestingInfo(id: string): Promise<VestingInfo> {
    return this.raw("solen_getVestingInfo", [id]);
  }
  getProposals(): Promise<ProposalInfo[]> {
    return this.raw("solen_getGovernanceProposals");
  }
  getAccountTxs(id: string, limit = 25): Promise<TxDetails[]> {
    return this.raw("solen_getAccountTransactions", [id, limit]);
  }
}

// Single shared instance, re-created when user changes RPC URL.
let active: Rpc | null = null;
let activeUrl: string | null = null;

export function getRpc(url: string): Rpc {
  if (!active || activeUrl !== url) {
    active = new Rpc(url);
    activeUrl = url;
  }
  return active;
}
