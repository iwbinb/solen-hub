import { hexToBytes } from "./utils";
export class SmartAccount {
    id;
    idBytes;
    client;
    constructor(accountIdHex, client) {
        this.id = accountIdHex;
        this.idBytes = hexToBytes(accountIdHex);
        this.client = client;
    }
    /** Get account info from the chain. */
    async getInfo() {
        return this.client.getAccount(this.id);
    }
    /** Get current balance. */
    async getBalance() {
        return this.client.getBalance(this.id);
    }
    /** Get current nonce. */
    async getNonce() {
        const info = await this.getInfo();
        return info.nonce;
    }
    /** Build a transfer operation (unsigned). */
    async buildTransfer(toHex, amount, maxFee = 10000) {
        const nonce = await this.getNonce();
        return {
            sender: this.idBytes,
            nonce,
            actions: [{ Transfer: { to: toHex, amount } }],
            max_fee: maxFee,
            signature: [],
        };
    }
    /** Build a contract call operation (unsigned). */
    async buildCall(targetHex, method, args = [], maxFee = 50000) {
        const nonce = await this.getNonce();
        return {
            sender: this.idBytes,
            nonce,
            actions: [{ Call: { target: targetHex, method, args } }],
            max_fee: maxFee,
            signature: [],
        };
    }
    /** Build a deploy operation (unsigned). */
    async buildDeploy(code, salt, maxFee = 100000) {
        const nonce = await this.getNonce();
        return {
            sender: this.idBytes,
            nonce,
            actions: [{ Deploy: { code, salt } }],
            max_fee: maxFee,
            signature: [],
        };
    }
    /** Simulate an operation without modifying state. */
    async simulate(op) {
        return this.client.simulateOperation(op);
    }
    /** Submit a signed operation. */
    async submit(op) {
        return this.client.submitOperation(op);
    }
}
