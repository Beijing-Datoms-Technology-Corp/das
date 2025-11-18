import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { KeyManagementService } from '../KeyManagementService';

suite('KeyManagementService Test Suite', () => {
	let testKeysDir: string;
	let originalKeysDir: string;

	suiteSetup(() => {
		// Save original keys directory and create test directory
		originalKeysDir = (KeyManagementService as any).KEY_DIR;
		testKeysDir = path.join(os.tmpdir(), 'das-test-keys');
		(KeyManagementService as any).KEY_DIR = testKeysDir;
	});

	suiteTeardown(() => {
		// Restore original keys directory and cleanup
		(KeyManagementService as any).KEY_DIR = originalKeysDir;
		try {
			if (fs.existsSync(testKeysDir)) {
				fs.rmSync(testKeysDir, { recursive: true, force: true });
			}
		} catch (error) {
			console.warn('Failed to cleanup test keys directory:', error);
		}
	});

	test('should generate key pair successfully', async () => {
		// Ensure no keys exist initially
		assert.strictEqual(KeyManagementService.keysExist(), false);

		// Generate keys
		await KeyManagementService.generateKeyPair();

		// Check that private key exists
		assert.strictEqual(KeyManagementService.keysExist(), true);

		// Check that private key file exists
		const privateKeyPath = path.join(testKeysDir, 'private.pem');
		assert.strictEqual(fs.existsSync(privateKeyPath), true);

		// Check that private key content is valid PEM format
		const privateKeyContent = fs.readFileSync(privateKeyPath, 'utf8');
		assert.strictEqual(privateKeyContent.includes('-----BEGIN PRIVATE KEY-----'), true);
		assert.strictEqual(privateKeyContent.includes('-----END PRIVATE KEY-----'), true);
	});

	test('should sign and verify data correctly', async () => {
		// Generate keys first
		await KeyManagementService.generateKeyPair();

		const testData = 'Hello, DAS World!';
		const signature = KeyManagementService.signData(testData);

		// Signature should be base64 encoded
		assert.strictEqual(typeof signature, 'string');
		assert.strictEqual(signature.length > 0, true);

		// Verify signature
		const isValid = KeyManagementService.verifySignature(testData, signature);
		assert.strictEqual(isValid, true);
	});

	test('should reject invalid signature', async () => {
		// Generate keys first
		await KeyManagementService.generateKeyPair();

		const testData = 'Hello, DAS World!';
		const invalidSignature = 'invalid-signature';

		// Verify should fail with invalid signature
		const isValid = KeyManagementService.verifySignature(testData, invalidSignature);
		assert.strictEqual(isValid, false);
	});

	test('should reject tampered data', async () => {
		// Generate keys first
		await KeyManagementService.generateKeyPair();

		const originalData = 'Hello, DAS World!';
		const signature = KeyManagementService.signData(originalData);

		const tamperedData = 'Hello, Modified World!';

		// Verify should fail with tampered data
		const isValid = KeyManagementService.verifySignature(tamperedData, signature);
		assert.strictEqual(isValid, false);
	});

	test('should return correct key status', async () => {
		// Initially no keys
		let status = KeyManagementService.getKeyStatus();
		assert.strictEqual(status.hasPrivateKey, false);

		// After generating keys
		await KeyManagementService.generateKeyPair();
		status = KeyManagementService.getKeyStatus();
		assert.strictEqual(status.hasPrivateKey, true);
		assert.strictEqual(status.hasPublicKey, true); // Public key should be generated
	});

	test('should handle missing keys gracefully', () => {
		// Ensure no keys exist
		try {
			if (fs.existsSync(testKeysDir)) {
				fs.rmSync(testKeysDir, { recursive: true, force: true });
			}
		} catch (error) {
			// Ignore cleanup errors
		}

		// Should not throw when keys don't exist
		assert.strictEqual(KeyManagementService.keysExist(), false);

		// Should return null for private key
		const privateKey = KeyManagementService.getPrivateKey();
		assert.strictEqual(privateKey, null);
	});
});
