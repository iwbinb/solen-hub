export class SolenClient {
    url;
    nextId = 1;
    constructor(config) {
        this.url = config.rpcUrl;
    }
    async call(method, params = []) {
        const request = {
            jsonrpc: "2.0",
            method,
            params,
            id: this.nextId++,
        };
        const response = await fetch(this.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const json = await response.json();
        if (json.error) {
            throw new Error(`RPC error ${json.error.code}: ${json.error.message}`);
        }
        return json.result;
    }
    /** Get the balance of an account. */
    async getBalance(accountId) {
        const result = await this.call("solen_getBalance", [accountId]);
        return BigInt(result);
    }
    /** Get full account info. */
    async getAccount(accountId) {
        return this.call("solen_getAccount", [accountId]);
    }
    /** Get a block by height. */
    async getBlock(height) {
        return this.call("solen_getBlock", [height]);
    }
    /** Get the latest block. */
    async getLatestBlock() {
        return this.call("solen_getLatestBlock", []);
    }
    /** Get chain status. */
    async chainStatus() {
        return this.call("solen_chainStatus", []);
    }
    /** Submit a signed user operation. */
    async submitOperation(op) {
        return this.call("solen_submitOperation", [op]);
    }
    /** Simulate a user operation without modifying state. */
    async simulateOperation(op) {
        return this.call("solen_simulateOperation", [op]);
    }
}
