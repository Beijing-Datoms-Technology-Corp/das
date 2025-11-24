/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createWriteStream, createReadStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import * as tar from 'tar-stream';
import { Readable, PassThrough } from 'stream';
import { KeyManagementService } from './KeyManagementService';

export interface DASManifest {
    name: string;
    version: string;
    description: string;
    created: string;
    updated?: string;
    standard_ref?: string | null;
}

export interface DASGraph {
    nodes: any[];
    edges: any[];
    metadata: any;
}

export class PackagingService {
    async build(workspacePath: string, outputPath: string): Promise<void> {
        // Read manifest
        const manifestPath = path.join(workspacePath, 'das-manifest.json');
        const manifest: DASManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        // Read graph
        const graphPath = path.join(workspacePath, 'das-graph.json');
        const graph: DASGraph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

        // Create tar stream
        const pack = tar.pack();

        // Add manifest
        pack.entry({ name: 'manifest.json' }, JSON.stringify(manifest, null, 2));

        // Add graph
        pack.entry({ name: 'graph.json' }, JSON.stringify(graph, null, 2));

        // Add all data files
        await this.addFilesToTar(pack, workspacePath, 'assets');

        // Calculate hashes
        const hashes = await this.calculateHashes(workspacePath);
        pack.entry({ name: 'hashes.json' }, JSON.stringify(hashes, null, 2));

        // Create signature (mock implementation)
        const signature = this.createSignature(hashes);
        pack.entry({ name: '_signature.sig' }, signature);

        pack.finalize();

        // Compress with gzip
        return new Promise((resolve, reject) => {
            const gzip = createGzip();
            const output = createWriteStream(outputPath);

            pack.pipe(gzip).pipe(output);

            output.on('finish', resolve);
            output.on('error', reject);
        });
    }

    private async addFilesToTar(pack: any, workspacePath: string, basePath: string): Promise<void> {
        const files = await this.getAllFiles(workspacePath);

        for (const file of files) {
            // Skip metadata files and hidden files
            if (file.endsWith('das-manifest.json') ||
                file.endsWith('das-graph.json') ||
                file.startsWith('.') ||
                file.includes('node_modules')) {
                continue;
            }

            const relativePath = path.relative(workspacePath, file);
            const tarPath = path.join(basePath, relativePath);

            const content = fs.readFileSync(file);
            pack.entry({ name: tarPath }, content);
        }
    }

    private async getAllFiles(dirPath: string): Promise<string[]> {
        const files: string[] = [];

        function scan(dir: string) {
            const items = fs.readdirSync(dir);

            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    if (!item.startsWith('.') && item !== 'node_modules') {
                        scan(fullPath);
                    }
                } else {
                    files.push(fullPath);
                }
            }
        }

        scan(dirPath);
        return files;
    }

    private async calculateHashes(workspacePath: string): Promise<{ [key: string]: string }> {
        const files = await this.getAllFiles(workspacePath);
        const hashes: { [key: string]: string } = {};

        for (const file of files) {
            // Skip metadata files
            if (file.endsWith('das-manifest.json') || file.endsWith('das-graph.json')) {
                continue;
            }

            const relativePath = path.relative(workspacePath, file);
            const content = fs.readFileSync(file);
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            hashes[relativePath] = hash;
        }

        return hashes;
    }

    private createSignature(hashes: { [key: string]: string }): string {
        const hashString = Object.entries(hashes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([path, hash]) => `${path}:${hash}`)
            .join('\n');

        return KeyManagementService.signData(hashString);
    }

    /**
     * Verify package signature
     */
    async verify(packagePath: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const gunzip = createGunzip();
            const extract = tar.extract();

            let signature: string | null = null;
            let hashes: { [key: string]: string } | null = null;
            const files: { [path: string]: Buffer } = {};

            extract.on('entry', (header, stream, next) => {
                const chunks: Buffer[] = [];

                stream.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                stream.on('end', () => {
                    const content = Buffer.concat(chunks);

                    if (header.name === '_signature.sig') {
                        signature = content.toString('utf8');
                    } else if (header.name === 'hashes.json') {
                        try {
                            hashes = JSON.parse(content.toString('utf8'));
                        } catch (error) {
                            reject(new Error('Invalid hashes.json'));
                            return;
                        }
                    } else if (header.name.startsWith('assets/')) {
                        const relativePath = header.name.substring('assets/'.length);
                        files[relativePath] = content;
                    }

                    next();
                });

                stream.resume();
            });

            extract.on('finish', () => {
                try {
                    if (!signature || !hashes) {
                        resolve(false);
                        return;
                    }

                    // Recalculate hashes for verification
                    const calculatedHashes: { [key: string]: string } = {};
                    for (const [filePath, content] of Object.entries(files)) {
                        const hash = crypto.createHash('sha256').update(content).digest('hex');
                        calculatedHashes[filePath] = hash;
                    }

                    // Create hash string for verification
                    const hashString = Object.entries(calculatedHashes)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([path, hash]) => `${path}:${hash}`)
                        .join('\n');

                    // Verify signature
                    const isValid = KeyManagementService.verifySignature(hashString, signature);
                    resolve(isValid);

                } catch (error) {
                    reject(error);
                }
            });

            extract.on('error', reject);

            // Create read stream and pipe through gunzip to tar extract
            createReadStream(packagePath)
                .pipe(gunzip)
                .pipe(extract);
        });
    }
}
