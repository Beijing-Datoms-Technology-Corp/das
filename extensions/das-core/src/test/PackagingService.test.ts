/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { PackagingService } from '../PackagingService';
import { KeyManagementService } from '../KeyManagementService';

suite('PackagingService Test Suite', () => {
	let testWorkspace: string;
	let testOutput: string;
	let originalKeysDir: string;

	suiteSetup(async () => {
		// Save original keys directory and create test directory
		originalKeysDir = (KeyManagementService as any).KEY_DIR;
		const testKeysDir = path.join(os.tmpdir(), 'das-test-keys-packaging');
		(KeyManagementService as any).KEY_DIR = testKeysDir;

		// Create test directories
		testWorkspace = path.join(os.tmpdir(), 'das-test-workspace');
		testOutput = path.join(os.tmpdir(), 'das-test-output');

		// Clean up any existing test directories
		[testWorkspace, testOutput, testKeysDir].forEach(dir => {
			try {
				if (fs.existsSync(dir)) {
					fs.rmSync(dir, { recursive: true, force: true });
				}
			} catch (error) {
				console.warn(`Failed to cleanup ${dir}:`, error);
			}
		});

		// Create fresh directories
		fs.mkdirSync(testWorkspace, { recursive: true });
		fs.mkdirSync(testOutput, { recursive: true });
		fs.mkdirSync(testKeysDir, { recursive: true });

		// Generate test keys
		await KeyManagementService.generateKeyPair();
	});

	suiteTeardown(() => {
		// Restore original keys directory and cleanup
		(KeyManagementService as any).KEY_DIR = originalKeysDir;

		[testWorkspace, testOutput].forEach(dir => {
			try {
				if (fs.existsSync(dir)) {
					fs.rmSync(dir, { recursive: true, force: true });
				}
			} catch (error) {
				console.warn(`Failed to cleanup ${dir}:`, error);
			}
		});
	});

	test('should build package successfully', async () => {
		// Create test workspace files
		const manifestPath = path.join(testWorkspace, 'das-manifest.json');
		const graphPath = path.join(testWorkspace, 'das-graph.json');
		const csvPath = path.join(testWorkspace, 'data.csv');
		const pdfPath = path.join(testWorkspace, 'document.pdf');

		// Create manifest
		const manifest = {
			name: 'Test Package',
			version: '1.0.0',
			description: 'Test package for unit tests',
			created: new Date().toISOString(),
			standard_ref: 'TEST-STANDARD'
		};
		fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

		// Create graph
		const graph = {
			nodes: [
				{ id: '1', name: 'data.csv', type: 'database' },
				{ id: '2', name: 'document.pdf', type: 'pdf' }
			],
			edges: [{ from: '1', to: '2' }],
			metadata: {}
		};
		fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

		// Create test CSV file
		const csvContent = 'id,name,value\n1,Test Item 1,100\n2,Test Item 2,200\n';
		fs.writeFileSync(csvPath, csvContent);

		// Create mock PDF file (just some binary data)
		const pdfContent = Buffer.from('Mock PDF content for testing');
		fs.writeFileSync(pdfPath, pdfContent);

		// Build package
		const outputPath = path.join(testOutput, 'test-package.das.gz');
		const packagingService = new PackagingService();
		await packagingService.build(testWorkspace, outputPath);

		// Verify output file exists
		assert.strictEqual(fs.existsSync(outputPath), true);

		// Verify file size is reasonable (should contain compressed data)
		const stats = fs.statSync(outputPath);
		assert.strictEqual(stats.size > 0, true);
		assert.strictEqual(stats.size > 100, true); // Should be more than just empty gzip
	});

	test('should verify package signature correctly', async () => {
		// Create a simple test package
		const manifestPath = path.join(testWorkspace, 'das-manifest.json');
		const graphPath = path.join(testWorkspace, 'das-graph.json');
		const testFilePath = path.join(testWorkspace, 'test.txt');

		// Create minimal files
		const manifest = {
			name: 'Verification Test',
			version: '1.0.0',
			description: 'Test for signature verification',
			created: new Date().toISOString()
		};
		fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

		const graph = { nodes: [], edges: [], metadata: {} };
		fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

		const testContent = 'Test file content for verification';
		fs.writeFileSync(testFilePath, testContent);

		// Build package
		const outputPath = path.join(testOutput, 'verification-test.das.gz');
		const packagingService = new PackagingService();
		await packagingService.build(testWorkspace, outputPath);

		// Verify the package
		const isValid = await packagingService.verify(outputPath);
		assert.strictEqual(isValid, true);
	});

	test('should reject tampered package', async () => {
		// Create a valid package first
		const manifestPath = path.join(testWorkspace, 'das-manifest.json');
		const graphPath = path.join(testWorkspace, 'das-graph.json');

		const manifest = {
			name: 'Tamper Test',
			version: '1.0.0',
			description: 'Test for tamper detection',
			created: new Date().toISOString()
		};
		fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

		const graph = { nodes: [], edges: [], metadata: {} };
		fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

		// Build package
		const outputPath = path.join(testOutput, 'tamper-test.das.gz');
		const packagingService = new PackagingService();
		await packagingService.build(testWorkspace, outputPath);

		// Tamper with the file by appending some data
		const tamperedContent = fs.readFileSync(outputPath);
		const tamperedPath = path.join(testOutput, 'tampered.das.gz');
		fs.writeFileSync(tamperedPath, Buffer.concat([tamperedContent, Buffer.from('tampered data')]));

		// Verify should fail
		const isValid = await packagingService.verify(tamperedPath);
		assert.strictEqual(isValid, false);
	});

	test('should handle missing keys gracefully', async () => {
		// Remove test keys to simulate missing keys
		const testKeysDir = (KeyManagementService as any).KEY_DIR;
		try {
			if (fs.existsSync(testKeysDir)) {
				fs.rmSync(testKeysDir, { recursive: true, force: true });
			}
		} catch (error) {
			// Ignore cleanup errors
		}

		// Create minimal workspace
		const manifestPath = path.join(testWorkspace, 'das-manifest.json');
		const graphPath = path.join(testWorkspace, 'das-graph.json');

		const manifest = {
			name: 'No Keys Test',
			version: '1.0.0',
			description: 'Test without keys',
			created: new Date().toISOString()
		};
		fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

		const graph = { nodes: [], edges: [], metadata: {} };
		fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

		// Attempting to build should throw an error
		const outputPath = path.join(testOutput, 'no-keys-test.das.gz');
		const packagingService = new PackagingService();

		try {
			await packagingService.build(testWorkspace, outputPath);
			assert.fail('Should have thrown an error due to missing keys');
		} catch (error: any) {
			assert.strictEqual(error.message.includes('Private key not found'), true);
		}
	});
});
