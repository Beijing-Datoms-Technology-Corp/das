import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class KeyManagementService {
    private static readonly KEY_DIR = path.join(os.homedir(), '.das', 'keys');
    private static readonly PRIVATE_KEY_PATH = path.join(KeyManagementService.KEY_DIR, 'private.pem');
    private static readonly PUBLIC_KEY_PATH = path.join(os.homedir(), 'public.pem');

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

            // Save private key (secure location)
            fs.writeFileSync(this.PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });

            // Get workspace folder to save public key
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const publicKeyPath = path.join(workspaceFolder.uri.fsPath, 'cert.pub');
                fs.writeFileSync(publicKeyPath, publicKey);
                vscode.window.showInformationMessage(`Keys generated successfully! Private key saved securely, public key saved to workspace.`);
            } else {
                vscode.window.showErrorMessage('No workspace folder open');
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate keys: ${error}`);
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
            console.error('Failed to read private key:', error);
            return null;
        }
    }

    /**
     * Get public key for verification
     */
    static getPublicKey(workspacePath?: string): string | null {
        try {
            // Try workspace public key first
            if (workspacePath) {
                const workspacePublicKey = path.join(workspacePath, 'cert.pub');
                if (fs.existsSync(workspacePublicKey)) {
                    return fs.readFileSync(workspacePublicKey, 'utf8');
                }
            }

            // Fallback to user public key
            if (fs.existsSync(this.PUBLIC_KEY_PATH)) {
                return fs.readFileSync(this.PUBLIC_KEY_PATH, 'utf8');
            }

            return null;
        } catch (error) {
            console.error('Failed to read public key:', error);
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
    static verifySignature(data: string, signature: string, workspacePath?: string): boolean {
        const publicKey = this.getPublicKey(workspacePath);
        if (!publicKey) {
            throw new Error('Public key not found');
        }

        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(data);
        return verify.verify(publicKey, signature, 'base64');
    }

    /**
     * Ensure key directory exists with proper permissions
     */
    private static async ensureKeyDirectory(): Promise<void> {
        const keyDir = path.dirname(this.PRIVATE_KEY_PATH);

        if (!fs.existsSync(keyDir)) {
            fs.mkdirSync(keyDir, { recursive: true, mode: 0o700 });
        }

        // Set proper permissions on key directory
        try {
            fs.chmodSync(keyDir, 0o700);
        } catch (error) {
            // Ignore permission errors on some systems
            console.warn('Could not set key directory permissions:', error);
        }
    }

    /**
     * Get key status information
     */
    static getKeyStatus(): { hasPrivateKey: boolean; hasPublicKey: boolean; workspacePath?: string } {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const workspacePath = workspaceFolder?.uri.fsPath;

        let hasPublicKey = false;
        if (workspacePath) {
            hasPublicKey = fs.existsSync(path.join(workspacePath, 'cert.pub'));
        }

        return {
            hasPrivateKey: this.keysExist(),
            hasPublicKey: hasPublicKey || fs.existsSync(this.PUBLIC_KEY_PATH),
            workspacePath
        };
    }
}
