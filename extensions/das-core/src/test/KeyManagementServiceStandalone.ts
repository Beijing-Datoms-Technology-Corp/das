import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class KeyManagementServiceStandalone {
    private static readonly KEY_DIR = path.join(os.tmpdir(), 'das-test-keys');
    private static readonly PRIVATE_KEY_PATH = path.join(KeyManagementServiceStandalone.KEY_DIR, 'private.pem');
    private static readonly PUBLIC_KEY_PATH = path.join(os.tmpdir(), 'das-test-public.pem');

    /**
     * Generate RSA key pair
     */
    static async generateKeyPair(): Promise<void> {
        try {
            // Ensure key directory exists
            await this.ensureKeyDirectory();

            // Generate key pair
            const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            });

            // Save private key
            fs.writeFileSync(this.PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
            // Save public key
            fs.writeFileSync(this.PUBLIC_KEY_PATH, publicKey);

        } catch (error) {
            throw error;
        }
    }

    /**
     * Check if keys exist
     */
    static keysExist(): boolean {
        return fs.existsSync(this.PRIVATE_KEY_PATH);
    }

    /**
     * Get private key for signing
     */
    static getPrivateKey(): string | null {
        try {
            if (!this.keysExist()) {
                return null;
            }
            return fs.readFileSync(this.PRIVATE_KEY_PATH, 'utf8');
        } catch (error) {
            return null;
        }
    }

    /**
     * Sign data with private key
     */
    static signData(data: string): string {
        const privateKey = this.getPrivateKey();
        if (!privateKey) {
            throw new Error('Private key not found. Please generate keys first.');
        }

        const sign = crypto.createSign('RSA-SHA256');
        sign.update(data);
        return sign.sign(privateKey, 'base64');
    }

    /**
     * Verify signature with public key
     */
    static verifySignature(data: string, signature: string): boolean {
        try {
            if (!fs.existsSync(this.PUBLIC_KEY_PATH)) {
                return false;
            }

            const publicKey = fs.readFileSync(this.PUBLIC_KEY_PATH, 'utf8');
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(data);
            return verify.verify(publicKey, signature, 'base64');
        } catch (error) {
            return false;
        }
    }

    /**
     * Ensure key directory exists
     */
    private static async ensureKeyDirectory(): Promise<void> {
        if (!fs.existsSync(this.KEY_DIR)) {
            fs.mkdirSync(this.KEY_DIR, { recursive: true, mode: 0o700 });
        }
    }

    /**
     * Cleanup test keys
     */
    static cleanup(): void {
        try {
            if (fs.existsSync(this.PRIVATE_KEY_PATH)) {
                fs.unlinkSync(this.PRIVATE_KEY_PATH);
            }
            if (fs.existsSync(this.PUBLIC_KEY_PATH)) {
                fs.unlinkSync(this.PUBLIC_KEY_PATH);
            }
            if (fs.existsSync(this.KEY_DIR)) {
                fs.rmSync(this.KEY_DIR, { recursive: true, force: true });
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}
