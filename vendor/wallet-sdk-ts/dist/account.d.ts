/**
 * Smart account management and transaction building.
 */
import { SolenClient } from "./client";
import type { AccountInfo, SimulationResult, SubmitResult, UserOperation } from "./types";
export declare class SmartAccount {
    readonly id: string;
    private idBytes;
    private client;
    constructor(accountIdHex: string, client: SolenClient);
    /** Get account info from the chain. */
    getInfo(): Promise<AccountInfo>;
    /** Get current balance. */
    getBalance(): Promise<bigint>;
    /** Get current nonce. */
    getNonce(): Promise<number>;
    /** Build a transfer operation (unsigned). */
    buildTransfer(toHex: string, amount: number, maxFee?: number): Promise<UserOperation>;
    /** Build a contract call operation (unsigned). */
    buildCall(targetHex: string, method: string, args?: number[], maxFee?: number): Promise<UserOperation>;
    /** Build a deploy operation (unsigned). */
    buildDeploy(code: number[], salt: number[], maxFee?: number): Promise<UserOperation>;
    /** Simulate an operation without modifying state. */
    simulate(op: UserOperation): Promise<SimulationResult>;
    /** Submit a signed operation. */
    submit(op: UserOperation): Promise<SubmitResult>;
}
