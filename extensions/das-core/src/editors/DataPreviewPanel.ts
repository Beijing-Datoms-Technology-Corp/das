import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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
                // For parquet files, we'll show a placeholder for now
                // In a full implementation, you'd use DuckDB WASM to read parquet
                data = [{ status: 'Parquet file preview not yet implemented', size: this.getFileSize(filePath) }];
                columns = ['status', 'size'];
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
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: var(--vscode-font-family);
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        height: 100vh;
                        display: flex;
                        flex-direction: column;
                    }

                    .toolbar {
                        padding: 10px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        background-color: var(--vscode-editorWidget-background);
                        display: flex;
                        gap: 10px;
                        align-items: center;
                    }

                    .query-input {
                        flex: 1;
                        padding: 5px 8px;
                        border: 1px solid var(--vscode-input-border);
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border-radius: 3px;
                    }

                    .execute-btn {
                        padding: 5px 12px;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                    }

                    .execute-btn:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }

                    .data-container {
                        flex: 1;
                        overflow: auto;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 12px;
                    }

                    th, td {
                        padding: 8px;
                        text-align: left;
                        border-bottom: 1px solid var(--vscode-list-inactiveSelectionBackground);
                    }

                    th {
                        background-color: var(--vscode-sideBarSectionHeader-background);
                        font-weight: bold;
                        position: sticky;
                        top: 0;
                    }

                    tr:nth-child(even) {
                        background-color: var(--vscode-list-inactiveSelectionBackground);
                    }

                    tr:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }

                    .loading {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 200px;
                        font-size: 16px;
                    }

                    .error {
                        color: var(--vscode-errorForeground);
                        padding: 20px;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <span>SQL Query:</span>
                    <input type="text" class="query-input" id="queryInput" placeholder="SELECT * FROM data WHERE..." />
                    <button class="execute-btn" onclick="executeQuery()">Execute</button>
                </div>
                <div class="data-container">
                    <div id="loading" class="loading">Loading data...</div>
                    <div id="error" class="error" style="display: none;"></div>
                    <table id="dataTable" style="display: none;">
                        <thead id="tableHead"></thead>
                        <tbody id="tableBody"></tbody>
                    </table>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();

                    function showLoading() {
                        document.getElementById('loading').style.display = 'flex';
                        document.getElementById('error').style.display = 'none';
                        document.getElementById('dataTable').style.display = 'none';
                    }

                    function showError(message) {
                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('error').style.display = 'block';
                        document.getElementById('dataTable').style.display = 'none';
                        document.getElementById('error').textContent = message;
                    }

                    function showData(data, columns) {
                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('error').style.display = 'none';
                        document.getElementById('dataTable').style.display = 'table';

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
                                td.textContent = row[col] || '';
                                tr.appendChild(td);
                            });
                            tbody.appendChild(tr);
                        });
                    }

                    function executeQuery() {
                        const query = document.getElementById('queryInput').value.trim();
                        if (!query) {
                            showError('Please enter a query');
                            return;
                        }

                        showLoading();
                        vscode.postMessage({
                            type: 'executeQuery',
                            query
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
                                // For now, just reload data
                                showData(message.data || [], message.columns || []);
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
