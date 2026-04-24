/**
 * JSON-RPC client for communicating with a Solen node.
 */
import type { SolenConfig, AccountInfo, BlockInfo, ChainStatus, SimulationResult, SubmitResult, UserOperation } from "./types";
export declare class SolenClient {
    private url;
    private nextId;
    constructor(config: SolenConfig);
    private call;
    /** Get the balance of an account. */
    getBalance(accountId: string): Promise<bigint>;
    /** Get full account info. */
    getAccount(accountId: string): Promise<AccountInfo>;
    /** Get a block by height. */
    getBlock(height: number): Promise<BlockInfo>;
    /** Get the latest block. */
    getLatestBlock(): Promise<BlockInfo>;
    /** Get chain status. */
    chainStatus(): Promise<ChainStatus>;
    /** Submit a signed user operation. */
    submitOperation(op: UserOperation): Promise<SubmitResult>;
    /** Simulate a user operation without modifying state. */
    simulateOperation(op: UserOperation): Promise<SimulationResult>;
}
