/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { WeaverPanelEnhanced } from './WeaverPanelEnhanced';
import { PackagingService } from './PackagingService';
import { DataPreviewPanel } from './editors/DataPreviewPanel';
import { KeyManagementService } from './KeyManagementService';

export function activate(context: vscode.ExtensionContext) {
    console.log('DAS Core extension is now active!');

    // 注册数据预览面板
    context.subscriptions.push(DataPreviewPanel.register(context));

    // 注册初始化工作区命令
    const initWorkspaceCommand = vscode.commands.registerCommand('das.initWorkspace', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const manifestPath = vscode.Uri.joinPath(workspaceFolder.uri, 'das-manifest.json');
        try {
            await vscode.workspace.fs.stat(manifestPath);
            vscode.window.showInformationMessage('DAS workspace already initialized');
            return;
        } catch {
            // 文件不存在，继续创建
        }

        const manifest = {
            name: 'DAS Workspace',
            version: '1.0.0',
            description: 'Data Assets Studio workspace',
            created: new Date().toISOString(),
            standard_ref: null
        };

        await vscode.workspace.fs.writeFile(
            manifestPath,
            Buffer.from(JSON.stringify(manifest, null, 2), 'utf8')
        );

        // 创建空的编织文件
        const graphPath = vscode.Uri.joinPath(workspaceFolder.uri, 'das-graph.json');
        const graph = {
            nodes: [],
            edges: [],
            metadata: {}
        };

        await vscode.workspace.fs.writeFile(
            graphPath,
            Buffer.from(JSON.stringify(graph, null, 2), 'utf8')
        );

        vscode.window.showInformationMessage('DAS workspace initialized successfully');
    });

    // 注册打开编织器命令
    const openWeaverCommand = vscode.commands.registerCommand('das.openWeaver', () => {
        WeaverPanelEnhanced.createOrShow(context.extensionUri);
    });

    // 注册密钥生成命令
    const generateKeysCommand = vscode.commands.registerCommand('das.generateKeys', async () => {
        try {
            await KeyManagementService.generateKeyPair();
        } catch (error) {
            // Error already shown in the service
        }
    });

    // 注册打包命令
    const buildPackageCommand = vscode.commands.registerCommand('das.buildPackage', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Check if keys exist
        if (!KeyManagementService.keysExist()) {
            const result = await vscode.window.showWarningMessage(
                'No signing keys found. Generate keys first?',
                'Generate Keys',
                'Cancel'
            );

            if (result === 'Generate Keys') {
                try {
                    await KeyManagementService.generateKeyPair();
                } catch (error) {
                    return; // Stop if key generation fails
                }
            } else {
                return;
            }
        }

        const outputPath = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.joinPath(workspaceFolder.uri, '../workspace.das.gz'),
            filters: {
                'DAS Package': ['das.gz']
            }
        });

        if (!outputPath) {
            return;
        }

        try {
            const packagingService = new PackagingService();
            await packagingService.build(workspaceFolder.uri.fsPath, outputPath.fsPath);
            vscode.window.showInformationMessage('DAS package built successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to build package: ${error}`);
        }
    });

    // 注册验签命令
    const verifyPackageCommand = vscode.commands.registerCommand('das.verifyPackage', async () => {
        const packageUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            filters: {
                'DAS Package': ['das.gz', 'das']
            }
        });

        if (!packageUri || packageUri.length === 0) {
            return;
        }

        try {
            const packagingService = new PackagingService();
            const isValid = await packagingService.verify(packageUri[0].fsPath);

            if (isValid) {
                vscode.window.showInformationMessage('✅ Package signature is valid');
            } else {
                vscode.window.showErrorMessage('❌ Package signature is invalid or corrupted');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to verify package: ${error}`);
        }
    });

    // 注册应用标准命令
    const applyStandardCommand = vscode.commands.registerCommand('das.applyStandard', async () => {
        const standards = [
            'GB/T-XXXX - 国家标准示例',
            '行业标准 A - 行业规范示例',
            '企业标准 B - 企业规范示例'
        ];

        const selectedStandard = await vscode.window.showQuickPick(standards, {
            placeHolder: 'Select a data standard to apply'
        });

        if (!selectedStandard) {
            return;
        }

        await applyStandardToManifest(selectedStandard);
    });

    // 注册具体的标准命令
    const applyStandardGbCommand = vscode.commands.registerCommand('das.applyStandard.gb', async () => {
        await applyStandardToManifest('GB/T-XXXX - 国家标准示例');
    });

    const applyStandardIndustryCommand = vscode.commands.registerCommand('das.applyStandard.industry', async () => {
        await applyStandardToManifest('行业标准 A - 行业规范示例');
    });

    const applyStandardEnterpriseCommand = vscode.commands.registerCommand('das.applyStandard.enterprise', async () => {
        await applyStandardToManifest('企业标准 B - 企业规范示例');
    });

    async function applyStandardToManifest(standard: string) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const manifestPath = vscode.Uri.joinPath(workspaceFolder.uri, 'das-manifest.json');
        try {
            const manifestContent = await vscode.workspace.fs.readFile(manifestPath);
            const manifest = JSON.parse(manifestContent.toString());
            manifest.standard_ref = standard;
            manifest.updated = new Date().toISOString();

            await vscode.workspace.fs.writeFile(
                manifestPath,
                Buffer.from(JSON.stringify(manifest, null, 2), 'utf8')
            );

            vscode.window.showInformationMessage(`Applied standard: ${standard}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to apply standard: ${error}`);
        }
    }

    context.subscriptions.push(
        initWorkspaceCommand,
        openWeaverCommand,
        generateKeysCommand,
        buildPackageCommand,
        verifyPackageCommand,
        applyStandardCommand,
        applyStandardGbCommand,
        applyStandardIndustryCommand,
        applyStandardEnterpriseCommand
    );
}

export function deactivate() {}
