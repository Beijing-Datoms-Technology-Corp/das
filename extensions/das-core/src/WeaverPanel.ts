import * as vscode from 'vscode';
import * as path from 'path';

export class WeaverPanel {
    public static currentPanel: WeaverPanel | undefined;
    public static readonly viewType = 'dasWeaver';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.ViewColumn.One;

        if (WeaverPanel.currentPanel) {
            WeaverPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            WeaverPanel.viewType,
            'DAS Data Weaver',
            column,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );

        WeaverPanel.currentPanel = new WeaverPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'saveGraph':
                        await this._saveGraph(message.data);
                        return;
                    case 'loadFiles':
                        await this._loadWorkspaceFiles();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        WeaverPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _saveGraph(graphData: any) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const graphPath = vscode.Uri.joinPath(workspaceFolder.uri, 'das-graph.json');
        try {
            await vscode.workspace.fs.writeFile(
                graphPath,
                Buffer.from(JSON.stringify(graphData, null, 2), 'utf8')
            );
            vscode.window.showInformationMessage('Graph saved successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save graph: ${error}`);
        }
    }

    private async _loadWorkspaceFiles() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const files: Array<{ name: string; type: string; path: string }> = [];

        async function scanDirectory(dirUri: vscode.Uri, relativePath = '') {
            try {
                const entries = await vscode.workspace.fs.readDirectory(dirUri);
                for (const [name, type] of entries) {
                    if (name.startsWith('.') || name === 'node_modules') {
                        continue;
                    }

                    const fullPath = path.join(relativePath, name);
                    if (type === vscode.FileType.Directory) {
                        await scanDirectory(vscode.Uri.joinPath(dirUri, name), fullPath);
                    } else {
                        const ext = path.extname(name).toLowerCase();
                        let fileType = 'document';
                        if (['.pdf'].includes(ext)) {
                            fileType = 'pdf';
                        } else if (['.sql', '.parquet', '.csv'].includes(ext)) {
                            fileType = 'database';
                        } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
                            fileType = 'image';
                        }

                        files.push({
                            name,
                            type: fileType,
                            path: fullPath
                        });
                    }
                }
            } catch (error) {
                console.error('Error scanning directory:', error);
            }
        }

        await scanDirectory(workspaceFolder.uri);

        // Send files to webview
        this._panel.webview.postMessage({
            type: 'filesLoaded',
            files
        });
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'DAS Data Weaver';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'weaver.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'weaver.css'));

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>DAS Data Weaver</title>
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
                    }

                    .main-content {
                        flex: 1;
                        display: flex;
                    }

                    .file-list {
                        width: 250px;
                        border-right: 1px solid var(--vscode-panel-border);
                        background-color: var(--vscode-sideBar-background);
                        overflow-y: auto;
                    }

                    .file-list h3 {
                        padding: 10px;
                        margin: 0;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        background-color: var(--vscode-sideBarSectionHeader-background);
                    }

                    .file-item {
                        padding: 8px 10px;
                        cursor: pointer;
                        border-bottom: 1px solid var(--vscode-list-inactiveSelectionBackground);
                    }

                    .file-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }

                    .canvas-container {
                        flex: 1;
                        position: relative;
                    }

                    #canvas {
                        width: 100%;
                        height: 100%;
                        border: none;
                    }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <button onclick="saveGraph()">Save Graph</button>
                    <button onclick="loadFiles()">Refresh Files</button>
                </div>
                <div class="main-content">
                    <div class="file-list">
                        <h3>Workspace Files</h3>
                        <div id="file-list"></div>
                    </div>
                    <div class="canvas-container">
                        <canvas id="canvas"></canvas>
                    </div>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    let nodes = [];
                    let edges = [];
                    let selectedNode = null;
                    let isDragging = false;
                    let dragOffset = { x: 0, y: 0 };

                    // Simple canvas-based graph renderer
                    const canvas = document.getElementById('canvas');
                    const ctx = canvas.getContext('2d');

                    function resizeCanvas() {
                        canvas.width = canvas.parentElement.clientWidth;
                        canvas.height = canvas.parentElement.clientHeight;
                        draw();
                    }

                    function draw() {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);

                        // Draw edges
                        ctx.strokeStyle = '#666';
                        ctx.lineWidth = 2;
                        edges.forEach(edge => {
                            const fromNode = nodes.find(n => n.id === edge.from);
                            const toNode = nodes.find(n => n.id === edge.to);
                            if (fromNode && toNode) {
                                ctx.beginPath();
                                ctx.moveTo(fromNode.x + 50, fromNode.y + 25);
                                ctx.lineTo(toNode.x + 50, toNode.y + 25);
                                ctx.stroke();

                                // Draw arrow
                                const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
                                ctx.beginPath();
                                ctx.moveTo(toNode.x + 50, toNode.y + 25);
                                ctx.lineTo(toNode.x + 50 - 10 * Math.cos(angle - Math.PI/6), toNode.y + 25 - 10 * Math.sin(angle - Math.PI/6));
                                ctx.moveTo(toNode.x + 50, toNode.y + 25);
                                ctx.lineTo(toNode.x + 50 - 10 * Math.cos(angle + Math.PI/6), toNode.y + 25 - 10 * Math.sin(angle + Math.PI/6));
                                ctx.stroke();
                            }
                        });

                        // Draw nodes
                        nodes.forEach(node => {
                            ctx.fillStyle = node === selectedNode ? '#007acc' : '#f3f3f3';
                            ctx.fillRect(node.x, node.y, 100, 50);
                            ctx.strokeStyle = '#ccc';
                            ctx.strokeRect(node.x, node.y, 100, 50);

                            ctx.fillStyle = node === selectedNode ? 'white' : 'black';
                            ctx.font = '12px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText(node.label, node.x + 50, node.y + 30);
                        });
                    }

                    // Event handlers
                    canvas.addEventListener('mousedown', (e) => {
                        const rect = canvas.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;

                        selectedNode = nodes.find(node =>
                            x >= node.x && x <= node.x + 100 &&
                            y >= node.y && y <= node.y + 50
                        );

                        if (selectedNode) {
                            isDragging = true;
                            dragOffset.x = x - selectedNode.x;
                            dragOffset.y = y - selectedNode.y;
                        }
                        draw();
                    });

                    canvas.addEventListener('mousemove', (e) => {
                        if (isDragging && selectedNode) {
                            const rect = canvas.getBoundingClientRect();
                            selectedNode.x = e.clientX - rect.left - dragOffset.x;
                            selectedNode.y = e.clientY - rect.top - dragOffset.y;
                            draw();
                        }
                    });

                    canvas.addEventListener('mouseup', () => {
                        isDragging = false;
                    });

                    // Functions
                    function addNode(label, x, y, type) {
                        const node = {
                            id: Date.now().toString(),
                            label,
                            x: x || 100,
                            y: y || 100,
                            type
                        };
                        nodes.push(node);
                        draw();
                        return node;
                    }

                    function saveGraph() {
                        const graphData = {
                            nodes,
                            edges,
                            metadata: {}
                        };
                        vscode.postMessage({
                            type: 'saveGraph',
                            data: graphData
                        });
                    }

                    function loadFiles() {
                        vscode.postMessage({
                            type: 'loadFiles'
                        });
                    }

                    // Message handler
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'filesLoaded':
                                updateFileList(message.files);
                                break;
                        }
                    });

                    function updateFileList(files) {
                        const fileList = document.getElementById('file-list');
                        fileList.innerHTML = '';
                        files.forEach(file => {
                            const div = document.createElement('div');
                            div.className = 'file-item';
                            div.textContent = file.name;
                            div.draggable = true;
                            div.addEventListener('dragstart', (e) => {
                                e.dataTransfer.setData('application/json', JSON.stringify(file));
                            });
                            fileList.appendChild(div);
                        });
                    }

                    // Canvas drop handler
                    canvas.addEventListener('dragover', (e) => {
                        e.preventDefault();
                    });

                    canvas.addEventListener('drop', (e) => {
                        e.preventDefault();
                        const rect = canvas.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;

                        try {
                            const file = JSON.parse(e.dataTransfer.getData('application/json'));
                            addNode(file.name, x - 50, y - 25, file.type);
                        } catch (error) {
                            console.error('Error parsing dropped data:', error);
                        }
                    });

                    // Initialize
                    window.addEventListener('resize', resizeCanvas);
                    resizeCanvas();
                </script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
