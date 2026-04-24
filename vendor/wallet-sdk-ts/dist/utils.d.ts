/**
 * Hex and byte conversion utilities.
 */
/** Convert a hex string to a byte array. */
export declare function hexToBytes(hex: string): number[];
/** Convert a byte array to a hex string. */
export declare function bytesToHex(bytes: number[] | Uint8Array): string;
/**
 * @deprecated Account IDs are now Ed25519 public keys.
 * Use the public key hex directly as the account ID.
 * This function only exists for backward compatibility with devnet scripts.
 */
export declare function nameToAccountId(name: string): number[];
/**
 * @deprecated Account IDs are now Ed25519 public keys.
 * Use the public key hex directly as the account ID.
 */
export declare function nameToHex(name: string): string;
