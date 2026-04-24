/**
 * Passkey (WebAuthn) authentication support.
 *
 * This module provides helpers for registering and authenticating
 * with passkeys in browser environments.
 */
export class PasskeyAuth {
    /**
     * Check if WebAuthn is available in the current environment.
     */
    static isAvailable() {
        return (typeof globalThis !== "undefined" &&
            "PublicKeyCredential" in globalThis);
    }
}
