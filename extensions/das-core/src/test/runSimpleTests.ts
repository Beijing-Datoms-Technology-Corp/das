import * as path from 'path';

// Simple test runner for headless environment
async function runSimpleTests() {
    console.log('🧪 Running DAS Core Unit Tests...\n');

    try {
        // Import and run key management service tests
        console.log('Testing KeyManagementServiceStandalone...');
        const { KeyManagementServiceStandalone } = await import('./KeyManagementServiceStandalone');

        // Cleanup any existing test keys
        KeyManagementServiceStandalone.cleanup();

        // Test 1: Check initial state (no keys)
        const hasKeysInitially = KeyManagementServiceStandalone.keysExist();
        console.log(`✓ Initial key state check: ${hasKeysInitially ? 'HAS KEYS' : 'NO KEYS'}`);
        if (hasKeysInitially) {
            throw new Error('Should not have keys initially');
        }

        // Test 2: Generate keys
        console.log('Generating test keys...');
        await KeyManagementServiceStandalone.generateKeyPair();
        console.log('✓ Key generation completed');

        // Test 3: Check keys exist after generation
        const hasKeysAfter = KeyManagementServiceStandalone.keysExist();
        console.log(`✓ Keys exist after generation: ${hasKeysAfter}`);
        if (!hasKeysAfter) {
            throw new Error('Keys should exist after generation');
        }

        // Test 4: Sign and verify data
        console.log('Testing signature operations...');
        const signTestData = 'DAS Test Data';
        const signature = KeyManagementServiceStandalone.signData(signTestData);
        console.log(`✓ Data signed, signature length: ${signature.length}`);

        const isValid = KeyManagementServiceStandalone.verifySignature(signTestData, signature);
        console.log(`✓ Signature verification: ${isValid ? 'VALID' : 'INVALID'}`);
        if (!isValid) {
            throw new Error('Signature verification should pass');
        }

        // Test 5: Test with tampered data
        const isValidTampered = KeyManagementServiceStandalone.verifySignature('tampered data', signature);
        console.log(`✓ Tampered data verification: ${!isValidTampered ? 'CORRECTLY REJECTED' : 'INCORRECTLY ACCEPTED'}`);
        if (isValidTampered) {
            throw new Error('Tampered data should be rejected');
        }

        console.log('\n🎉 KeyManagementServiceStandalone tests PASSED!\n');

        // Test basic crypto operations (mimicking packaging)
        console.log('Testing core crypto operations...');

        // Test SHA256 hashing
        const crypto = await import('crypto');
        const testData = 'DAS packaging test data';
        const hash = crypto.default.createHash('sha256').update(testData).digest('hex');
        console.log(`✓ SHA256 hash generated: ${hash.substring(0, 16)}...`);

        // Test base64 encoding/decoding
        const encoded = Buffer.from(testData).toString('base64');
        const decoded = Buffer.from(encoded, 'base64').toString();
        console.log(`✓ Base64 encoding/decoding: ${testData === decoded ? 'PASSED' : 'FAILED'}`);

        if (testData !== decoded) {
            throw new Error('Base64 encoding/decoding failed');
        }

        console.log('\n🎉 Core crypto operations tests PASSED!\n');

        // Cleanup test keys
        KeyManagementServiceStandalone.cleanup();

        console.log('🎊 All DAS Core tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

runSimpleTests();
