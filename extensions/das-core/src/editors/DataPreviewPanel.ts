/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ParquetReader } from 'parquetjs-lite';

export class DataPreviewPanel implements vscode.CustomReadonlyEditorProvider {
    public static readonly viewType = 'das.dataPreview';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new DataPreviewPanel(context);
        return vscode.window.registerCustomEditorProvider(DataPreviewPanel.viewType, provider);
    }

    private readonly _context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        return new DataPreviewDocument(uri);
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        const dataDocument = document as DataPreviewDocument;
        const panel = new DataPreviewWebviewPanel(dataDocument, webviewPanel, this._context);
        await panel.initialize();
    }
}

class DataPreviewDocument implements vscode.CustomDocument {
    constructor(public readonly uri: vscode.Uri) {}

    dispose(): void {
        // Cleanup resources
    }
}

class DataPreviewWebviewPanel {
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _document: DataPreviewDocument,
        private readonly _panel: vscode.WebviewPanel,
        private readonly _context: vscode.ExtensionContext
    ) {
        this._panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._context.extensionUri, 'media'),
                vscode.Uri.file(path.dirname(this._document.uri.fsPath))
            ]
        };

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'executeQuery':
                        await this.executeQuery(message.query);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    async initialize(): Promise<void> {
        this._panel.webview.html = this.getHtmlForWebview();

        // Load initial data
        await this.loadData();
    }

    private async loadData(): Promise<void> {
        try {
            const filePath = this._document.uri.fsPath;
            const fileExt = path.extname(filePath).toLowerCase();

            let data: any[] = [];
            let columns: string[] = [];

            if (fileExt === '.csv') {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());

                if (lines.length > 0) {
                    // Simple CSV parser - assume first line is headers
                    columns = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));

                    // Parse first 1000 rows
                    const maxRows = Math.min(lines.length - 1, 1000);
                    for (let i = 1; i <= maxRows; i++) {
                        const values = lines[i].split(',').map(val => val.trim().replace(/"/g, ''));
                        const row: any = {};
                        columns.forEach((col, idx) => {
                            row[col] = values[idx] || '';
                        });
                        data.push(row);
                    }
                }
            } else if (fileExt === '.parquet') {
                try {
                    const parquetData = await this.loadParquetData(filePath);
                    data = parquetData.rows;
                    columns = parquetData.columns;
                } catch (error) {
                    console.error('Failed to load Parquet data:', error);
                    data = [{ status: `Failed to load Parquet file: ${error.message}`, size: this.getFileSize(filePath) }];
                    columns = ['status', 'size'];
                }
            } else {
                // For other formats, show basic info
                data = [{ filename: path.basename(filePath), size: this.getFileSize(filePath), type: fileExt }];
                columns = ['filename', 'size', 'type'];
            }

            this._panel.webview.postMessage({
                type: 'dataLoaded',
                data,
                columns
            });
        } catch (error) {
            this._panel.webview.postMessage({
                type: 'error',
                message: `Failed to load data: ${error}`
            });
        }
    }

    private async executeQuery(query: string): Promise<void> {
        // For now, implement a simple filter
        // In a full implementation, you'd use DuckDB WASM
        try {
            await this.loadData(); // Reload data
            // TODO: Implement actual query execution
            this._panel.webview.postMessage({
                type: 'queryResult',
                message: 'Query execution not yet implemented. Showing original data.'
            });
        } catch (error) {
            this._panel.webview.postMessage({
                type: 'error',
                message: `Query failed: ${error}`
            });
        }
    }

    private getFileSize(filePath: string): string {
        try {
            const stats = fs.statSync(filePath);
            const sizeInBytes = stats.size;
            if (sizeInBytes < 1024) return `${sizeInBytes} B`;
            if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
            return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
        } catch {
            return 'Unknown';
        }
    }

    private async loadParquetData(filePath: string): Promise<{ columns: string[]; rows: any[] }> {
        return new Promise((resolve, reject) => {
            try {
                const reader = new ParquetReader(filePath);

                reader.on('metadata', (metadata) => {
                    console.log('Parquet metadata:', metadata);
                });

                const rows: any[] = [];
                const columns: string[] = [];

                reader.on('data', (row) => {
                    // Limit to first 1000 rows for performance
                    if (rows.length < 1000) {
                        rows.push(row);
                    }
                });

                reader.on('end', () => {
                    // Extract column names from the first row if available
                    if (rows.length > 0) {
                        columns.push(...Object.keys(rows[0]));
                    }

                    resolve({ columns, rows });
                });

                reader.on('error', (error) => {
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    private getHtmlForWebview(): string {
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Data Preview</title>
                <style>
                    * {
                        box-sizing: border-box;
                    }

                    body {
                        margin: 0;
                        padding: 0;
                        font-family: var(--vscode-font-family);
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        height: 100vh;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }

                    .toolbar {
                        padding: 12px 16px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        background-color: var(--vscode-editorWidget-background);
                        display: flex;
                        gap: 12px;
                        align-items: center;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    }

                    .toolbar-title {
                        font-weight: 600;
                        font-size: 13px;
                        color: var(--vscode-foreground);
                        margin-right: 8px;
                    }

                    .query-input {
                        flex: 1;
                        padding: 6px 12px;
                        border: 1px solid var(--vscode-input-border);
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border-radius: 4px;
                        font-size: 13px;
                        outline: none;
                        transition: border-color 0.2s;
                    }

                    .query-input:focus {
                        border-color: var(--vscode-focusBorder);
                        box-shadow: 0 0 0 1px var(--vscode-focusBorder);
                    }

                    .query-input::placeholder {
                        color: var(--vscode-input-placeholderForeground);
                    }

                    .execute-btn {
                        padding: 6px 16px;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: 1px solid var(--vscode-button-border, transparent);
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }

                    .execute-btn:hover {
                        background-color: var(--vscode-button-hoverBackground);
                        transform: translateY(-1px);
                    }

                    .execute-btn:active {
                        transform: translateY(0);
                    }

                    .execute-btn:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }

                    .data-container {
                        flex: 1;
                        overflow: auto;
                    }

                    .data-grid {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 12px;
                        margin: 0;
                    }

                    .data-grid th,
                    .data-grid td {
                        padding: 8px 12px;
                        text-align: left;
                        border-bottom: 1px solid var(--vscode-list-inactiveSelectionBackground);
                        border-right: 1px solid var(--vscode-list-inactiveSelectionBackground);
                    }

                    .data-grid th {
                        background-color: var(--vscode-sideBarSectionHeader-background);
                        font-weight: 600;
                        position: sticky;
                        top: 0;
                        z-index: 10;
                        color: var(--vscode-sideBarSectionHeader-foreground);
                        border-top: 1px solid var(--vscode-panel-border);
                    }

                    .data-grid tbody tr {
                        transition: background-color 0.15s;
                    }

                    .data-grid tbody tr:nth-child(even) {
                        background-color: var(--vscode-list-inactiveSelectionBackground);
                    }

                    .data-grid tbody tr:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }

                    .data-grid tbody tr.selected {
                        background-color: var(--vscode-list-activeSelectionBackground);
                        color: var(--vscode-list-activeSelectionForeground);
                    }

                    .data-grid td.numeric {
                        text-align: right;
                        font-variant-numeric: tabular-nums;
                    }

                    .data-grid td.boolean {
                        text-align: center;
                    }

                    .loading-container {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        height: 300px;
                        gap: 16px;
                    }

                    .loading-spinner {
                        width: 32px;
                        height: 32px;
                        border: 3px solid var(--vscode-progressBar-background);
                        border-top: 3px solid var(--vscode-progressBar-foreground);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }

                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }

                    .loading-text {
                        color: var(--vscode-descriptionForeground);
                        font-size: 14px;
                        font-weight: 500;
                    }

                    .error-container {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        height: 300px;
                        gap: 12px;
                        text-align: center;
                        padding: 20px;
                    }

                    .error-icon {
                        font-size: 48px;
                        opacity: 0.6;
                    }

                    .error-title {
                        color: var(--vscode-errorForeground);
                        font-size: 16px;
                        font-weight: 600;
                        margin: 0;
                    }

                    .error-message {
                        color: var(--vscode-descriptionForeground);
                        font-size: 13px;
                        margin: 0;
                        max-width: 400px;
                    }

                    .retry-btn {
                        padding: 6px 12px;
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-button-border);
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        margin-top: 8px;
                        transition: all 0.2s;
                    }

                    .retry-btn:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <span class="toolbar-title">🔍 Data Preview</span>
                    <input type="text" class="query-input" id="queryInput" placeholder="Enter SQL query (e.g., SELECT * FROM data WHERE age > 25)" />
                    <button class="execute-btn" onclick="executeQuery()" id="executeBtn">
                        <span>▶️</span>
                        Execute
                    </button>
                </div>
                <div class="data-container">
                    <div id="loading" class="loading-container" style="display: none;">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Loading data...</div>
                    </div>
                    <div id="error" class="error-container" style="display: none;">
                        <div class="error-icon">⚠️</div>
                        <h3 class="error-title">Failed to load data</h3>
                        <p class="error-message" id="errorMessage">An unexpected error occurred</p>
                        <button class="retry-btn" onclick="retryLoad()">Retry</button>
                    </div>
                    <table id="dataTable" class="data-grid" style="display: none;">
                        <thead id="tableHead"></thead>
                        <tbody id="tableBody"></tbody>
                    </table>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();

                    let currentData = null;
                    let currentColumns = null;

                    function showLoading() {
                        document.getElementById('loading').style.display = 'flex';
                        document.getElementById('error').style.display = 'none';
                        document.getElementById('dataTable').style.display = 'none';
                        document.getElementById('executeBtn').disabled = true;
                    }

                    function hideLoading() {
                        document.getElementById('loading').style.display = 'none';
                    }

                    function showError(message) {
                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('error').style.display = 'flex';
                        document.getElementById('dataTable').style.display = 'none';
                        document.getElementById('executeBtn').disabled = true;
                        document.getElementById('errorMessage').textContent = message;
                    }

                    function showData(data, columns) {
                        currentData = data;
                        currentColumns = columns;

                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('error').style.display = 'none';
                        document.getElementById('dataTable').style.display = 'table';
                        document.getElementById('executeBtn').disabled = false;

                        const thead = document.getElementById('tableHead');
                        const tbody = document.getElementById('tableBody');

                        // Clear existing content
                        thead.innerHTML = '';
                        tbody.innerHTML = '';

                        // Create header
                        const headerRow = document.createElement('tr');
                        columns.forEach(col => {
                            const th = document.createElement('th');
                            th.textContent = col;
                            headerRow.appendChild(th);
                        });
                        thead.appendChild(headerRow);

                        // Create rows
                        data.forEach(row => {
                            const tr = document.createElement('tr');
                            columns.forEach(col => {
                                const td = document.createElement('td');
                                const value = row[col];

                                // Type detection and formatting
                                if (typeof value === 'number') {
                                    td.className = 'numeric';
                                    td.textContent = value.toLocaleString();
                                } else if (typeof value === 'boolean') {
                                    td.className = 'boolean';
                                    td.textContent = value ? '✓' : '✗';
                                } else {
                                    td.textContent = value || '';
                                }

                                tr.appendChild(td);
                            });
                            tbody.appendChild(tr);
                        });
                    }

                    function retryLoad() {
                        showLoading();
                        vscode.postMessage({
                            type: 'loadData'
                        });
                    }

                    // Handle messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'dataLoaded':
                                showData(message.data, message.columns);
                                break;
                            case 'queryResult':
                                hideLoading();
                                if (message.success) {
                                    showData(message.data, message.columns);
                                } else {
                                    showError(message.message || 'Query failed');
                                }
                                break;
                            case 'error':
                                showError(message.message);
                                break;
                        }
                    });

                    // Initial loading
                    showLoading();
                </script>
            </body>
            </html>`;
    }

    dispose(): void {
        while (this._disposables.length) {
            const x = this._disposables.pop()?.dispose();
        }
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
