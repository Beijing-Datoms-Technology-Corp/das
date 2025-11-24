/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as vscode from 'vscode';
import * as path from 'path';

export class WeaverPanelEnhanced {
    public static currentPanel: WeaverPanelEnhanced | undefined;
    public static readonly viewType = 'dasWeaverEnhanced';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.ViewColumn.One;

        if (WeaverPanelEnhanced.currentPanel) {
            WeaverPanelEnhanced.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            WeaverPanelEnhanced.viewType,
            'DAS Data Weaver (Enhanced)',
            column,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );

        WeaverPanelEnhanced.currentPanel = new WeaverPanelEnhanced(panel, extensionUri);
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
                    case 'openFile':
                        await this._openFile(message.filePath);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        WeaverPanelEnhanced.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop()?.dispose();
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

        const files: Array<{ name: string; type: string; path: string; size: string }> = [];

        async function scanDirectory(dirUri: vscode.Uri, relativePath = '') {
            try {
                const entries = await vscode.workspace.fs.readDirectory(dirUri);
                for (const [name, type] of entries) {
                    if (name.startsWith('.') || name === 'node_modules' || name === 'das-graph.json' || name === 'das-manifest.json') {
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

                        // Get file size
                        const stat = await vscode.workspace.fs.stat(vscode.Uri.joinPath(dirUri, name));
                        const size = formatFileSize(stat.size);

                        files.push({
                            name,
                            type: fileType,
                            path: fullPath,
                            size
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

    private async _openFile(filePath: string) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
        try {
            await vscode.commands.executeCommand('vscode.open', fileUri);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'DAS Data Weaver (Enhanced)';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.WebviewPanel['webview']) {
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>DAS Data Weaver Enhanced</title>
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
                        padding: 8px 12px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        background-color: var(--vscode-titleBar-activeBackground, var(--vscode-editorWidget-background));
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    }

                    .toolbar-section {
                        display: flex;
                        gap: 6px;
                        align-items: center;
                    }

                    .toolbar-section.right {
                        margin-left: auto;
                    }

                    .toolbar-btn {
                        padding: 6px 12px;
                        border: 1px solid transparent;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        transition: all 0.15s ease;
                        outline: none;
                    }

                    .toolbar-btn:hover {
                        transform: translateY(-1px);
                    }

                    .toolbar-btn.primary {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border-color: var(--vscode-button-border, transparent);
                    }

                    .toolbar-btn.primary:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }

                    .toolbar-btn.secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border-color: var(--vscode-button-border);
                    }

                    .toolbar-btn.secondary:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }

                    .toolbar-btn.danger {
                        background-color: var(--vscode-errorForeground);
                        color: var(--vscode-button-background);
                        opacity: 0.8;
                    }

                    .toolbar-btn.danger:hover {
                        opacity: 1;
                        background-color: var(--vscode-errorForeground);
                    }

                    .toolbar-btn:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                        transform: none !important;
                    }

                    .status-text {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        font-weight: 500;
                    }

                    .main-content {
                        flex: 1;
                        display: flex;
                    }

                    .file-tree {
                        width: 280px;
                        border-right: 1px solid var(--vscode-panel-border);
                        background-color: var(--vscode-sideBar-background);
                        overflow-y: auto;
                        display: flex;
                        flex-direction: column;
                    }

                    .file-tree-header {
                        padding: 10px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        background-color: var(--vscode-sideBarSectionHeader-background);
                        font-weight: bold;
                    }

                    .file-list {
                        flex: 1;
                        padding: 0;
                        margin: 0;
                        list-style: none;
                    }

                    .file-item {
                        display: flex;
                        align-items: center;
                        padding: 8px 10px;
                        cursor: grab;
                        border-bottom: 1px solid var(--vscode-list-inactiveSelectionBackground);
                        user-select: none;
                    }

                    .file-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }

                    .file-item.dragging {
                        opacity: 0.5;
                    }

                    .file-icon {
                        width: 16px;
                        height: 16px;
                        margin-right: 8px;
                        flex-shrink: 0;
                    }

                    .file-info {
                        flex: 1;
                        min-width: 0;
                    }

                    .file-name {
                        font-size: 13px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .file-size {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                    }

                    .canvas-container {
                        flex: 1;
                        position: relative;
                        background-color: var(--vscode-editor-background);
                    }

                    #canvas {
                        width: 100%;
                        height: 100%;
                        border: none;
                        background-color: var(--vscode-editor-background);
                    }

                    .node {
                        position: absolute;
                        background: var(--vscode-editorWidget-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        padding: 12px;
                        min-width: 140px;
                        text-align: center;
                        cursor: move;
                        user-select: none;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        transition: box-shadow 0.2s;
                    }

                    .node:hover {
                        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                        border-color: var(--vscode-focusBorder);
                    }

                    .node.selected {
                        border-color: var(--vscode-focusBorder);
                        box-shadow: 0 0 0 2px var(--vscode-focusBorder);
                    }

                    .node-label {
                        font-size: 13px;
                        font-weight: 500;
                        color: var(--vscode-editor-foreground);
                        margin-bottom: 4px;
                    }

                    .node-meta {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }

                    .node-type {
                        font-weight: 500;
                    }

                    .node-size {
                        opacity: 0.8;
                    }

                    .node-pdf {
                        border-left: 4px solid #ff6b6b;
                    }

                    .node-database {
                        border-left: 4px solid #4ecdc4;
                    }

                    .node-document {
                        border-left: 4px solid #45b7d1;
                    }

                    .node-image {
                        border-left: 4px solid #f9ca24;
                    }

                    .connection-line {
                        position: absolute;
                        pointer-events: none;
                        z-index: 1;
                    }

                    .connection-handle {
                        position: absolute;
                        width: 8px;
                        height: 8px;
                        background: var(--vscode-panel-border);
                        border-radius: 50%;
                        top: 50%;
                        transform: translateY(-50%);
                        cursor: crosshair;
                    }

                    .connection-handle.left {
                        left: -4px;
                    }

                    .connection-handle.right {
                        right: -4px;
                    }

                    .connecting {
                        background: var(--vscode-focusBorder) !important;
                    }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <div class="toolbar-section">
                        <button class="toolbar-btn primary" onclick="saveGraph()" title="Save Graph">
                            <span class="icon">💾</span>
                            <span class="text">Save</span>
                        </button>
                        <button class="toolbar-btn secondary" onclick="loadFiles()" title="Refresh Files">
                            <span class="icon">🔄</span>
                            <span class="text">Refresh</span>
                        </button>
                    </div>
                    <div class="toolbar-section">
                        <button class="toolbar-btn danger" onclick="clearCanvas()" title="Clear Canvas">
                            <span class="icon">🗑️</span>
                            <span class="text">Clear</span>
                        </button>
                        <button class="toolbar-btn secondary" onclick="fitToScreen()" title="Fit to Screen">
                            <span class="icon">📐</span>
                            <span class="text">Fit</span>
                        </button>
                    </div>
                    <div class="toolbar-section right">
                        <span class="status-text" id="statusText">Ready</span>
                    </div>
                </div>
                <div class="main-content">
                    <div class="file-tree">
                        <div class="file-tree-header">📁 Workspace Files</div>
                        <ul id="file-list" class="file-list"></ul>
                    </div>
                    <div class="canvas-container">
                        <canvas id="canvas"></canvas>
                    </div>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const canvas = document.getElementById('canvas');
                    const ctx = canvas.getContext('2d');

                    let nodes = [];
                    let connections = [];
                    let selectedNode = null;
                    let draggedNode = null;
                    let dragOffset = { x: 0, y: 0 };
                    let isConnecting = false;
                    let connectionStart = null;
                    let mousePos = { x: 0, y: 0 };
                    let scale = 1;
                    let offset = { x: 0, y: 0 };

                    // Initialize canvas
                    function resizeCanvas() {
                        const rect = canvas.getBoundingClientRect();
                        canvas.width = rect.width;
                        canvas.height = rect.height;
                        draw();
                    }

                    function draw() {
                        ctx.save();
                        ctx.clearRect(0, 0, canvas.width, canvas.height);

                        // Apply zoom and pan
                        ctx.translate(offset.x, offset.y);
                        ctx.scale(scale, scale);

                        // Draw grid
                        drawGrid();

                        // Draw connections
                        connections.forEach(conn => {
                            const fromNode = nodes.find(n => n.id === conn.from);
                            const toNode = nodes.find(n => n.id === conn.to);
                            if (fromNode && toNode) {
                                drawConnection(fromNode, toNode);
                            }
                        });

                        // Draw temporary connection
                        if (isConnecting && connectionStart) {
                            const startNode = nodes.find(n => n.id === connectionStart);
                            if (startNode) {
                                drawConnection(startNode, mousePos, true);
                            }
                        }

                        // Draw nodes
                        nodes.forEach(node => {
                            drawNode(node);
                        });

                        ctx.restore();

                        // Draw UI overlay (zoom indicator, etc.)
                        drawUI();
                    }

                    function drawGrid() {
                        const gridSize = 20;
                        ctx.strokeStyle = 'rgba(128, 128, 128, 0.1)';
                        ctx.lineWidth = 1;

                        const startX = -offset.x / scale;
                        const startY = -offset.y / scale;
                        const endX = startX + canvas.width / scale;
                        const endY = startY + canvas.height / scale;

                        for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
                            ctx.beginPath();
                            ctx.moveTo(x, startY);
                            ctx.lineTo(x, endY);
                            ctx.stroke();
                        }

                        for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
                            ctx.beginPath();
                            ctx.moveTo(startX, y);
                            ctx.lineTo(endX, y);
                            ctx.stroke();
                        }
                    }

                    function drawNode(node) {
                        const isSelected = node === selectedNode;
                        const width = 140;
                        const height = 60;

                        // Node background
                        ctx.fillStyle = isSelected ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-editorWidget-background)';
                        ctx.strokeStyle = isSelected ? 'var(--vscode-focusBorder)' : 'var(--vscode-panel-border)';
                        ctx.lineWidth = isSelected ? 2 : 1;

                        roundRect(node.x - width/2, node.y - height/2, width, height, 6);
                        ctx.fill();
                        ctx.stroke();

                        // Type-specific border
                        ctx.strokeStyle = getTypeColor(node.type);
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(node.x - width/2, node.y - height/2);
                        ctx.lineTo(node.x - width/2, node.y + height/2);
                        ctx.stroke();

                        // Node content
                        ctx.fillStyle = 'var(--vscode-editor-foreground)';
                        ctx.font = 'bold 13px var(--vscode-font-family)';
                        ctx.textAlign = 'center';
                        ctx.fillText(node.name, node.x, node.y - 8);

                        ctx.fillStyle = 'var(--vscode-descriptionForeground)';
                        ctx.font = '11px var(--vscode-font-family)';
                        ctx.fillText(\`\${node.type} • \${node.size}\`, node.x, node.y + 8);

                        // Connection handles
                        ctx.fillStyle = 'var(--vscode-panel-border)';
                        ctx.beginPath();
                        ctx.arc(node.x - width/2, node.y, 4, 0, 2 * Math.PI);
                        ctx.arc(node.x + width/2, node.y, 4, 0, 2 * Math.PI);
                        ctx.fill();
                    }

                    function drawConnection(fromNode, toNode, isTemporary = false) {
                        const fromX = fromNode.x + 70; // right side
                        const fromY = fromNode.y;
                        const toX = toNode.x - 70; // left side
                        const toY = toNode.y;

                        ctx.strokeStyle = isTemporary ? 'var(--vscode-focusBorder)' : 'var(--vscode-panel-border)';
                        ctx.lineWidth = isTemporary ? 2 : 1;

                        // Draw curved line
                        ctx.beginPath();
                        const midX = (fromX + toX) / 2;
                        ctx.moveTo(fromX, fromY);
                        ctx.quadraticCurveTo(midX, fromY, midX, (fromY + toY) / 2);
                        ctx.quadraticCurveTo(midX, toY, toX, toY);
                        ctx.stroke();

                        // Draw arrow
                        if (!isTemporary) {
                            const angle = Math.atan2(toY - fromY, toX - fromX);
                            ctx.beginPath();
                            ctx.moveTo(toX, toY);
                            ctx.lineTo(toX - 8 * Math.cos(angle - Math.PI/6), toY - 8 * Math.sin(angle - Math.PI/6));
                            ctx.moveTo(toX, toY);
                            ctx.lineTo(toX - 8 * Math.cos(angle + Math.PI/6), toY - 8 * Math.sin(angle + Math.PI/6));
                            ctx.stroke();
                        }
                    }

                    function drawUI() {
                        // Zoom indicator
                        ctx.fillStyle = 'var(--vscode-editorWidget-background)';
                        ctx.strokeStyle = 'var(--vscode-panel-border)';
                        ctx.lineWidth = 1;
                        roundRect(10, 10, 80, 30, 4);
                        ctx.fill();
                        ctx.stroke();

                        ctx.fillStyle = 'var(--vscode-editor-foreground)';
                        ctx.font = '11px var(--vscode-font-family)';
                        ctx.textAlign = 'center';
                        ctx.fillText(\`Zoom: \${Math.round(scale * 100)}%\`, 50, 28);
                    }

                    function roundRect(x, y, width, height, radius) {
                        ctx.beginPath();
                        ctx.moveTo(x + radius, y);
                        ctx.lineTo(x + width - radius, y);
                        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
                        ctx.lineTo(x + width, y + height - radius);
                        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                        ctx.lineTo(x + radius, y + height);
                        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
                        ctx.lineTo(x, y + radius);
                        ctx.quadraticCurveTo(x, y, x + radius, y);
                        ctx.closePath();
                    }

                    function getTypeColor(type) {
                        switch (type) {
                            case 'pdf': return '#ff6b6b';
                            case 'database': return '#4ecdc4';
                            case 'image': return '#f9ca24';
                            default: return '#45b7d1';
                        }
                    }

                    function getMousePos(event) {
                        const rect = canvas.getBoundingClientRect();
                        return {
                            x: (event.clientX - rect.left - offset.x) / scale,
                            y: (event.clientY - rect.top - offset.y) / scale
                        };
                    }

                    // Event handlers
                    canvas.addEventListener('mousedown', (e) => {
                        const pos = getMousePos(e);

                        if (e.button === 0) { // Left click
                            // Check for connection handles first
                            for (const node of nodes) {
                                const width = 140;
                                const leftHandle = {
                                    x: node.x - width/2,
                                    y: node.y,
                                    radius: 6
                                };
                                const rightHandle = {
                                    x: node.x + width/2,
                                    y: node.y,
                                    radius: 6
                                };

                                if (Math.pow(pos.x - leftHandle.x, 2) + Math.pow(pos.y - leftHandle.y, 2) < Math.pow(leftHandle.radius, 2)) {
                                    isConnecting = true;
                                    connectionStart = node.id;
                                    return;
                                }
                                if (Math.pow(pos.x - rightHandle.x, 2) + Math.pow(pos.y - rightHandle.y, 2) < Math.pow(rightHandle.radius, 2)) {
                                    isConnecting = true;
                                    connectionStart = node.id;
                                    return;
                                }
                            }

                            // Check for node selection
                            selectedNode = null;
                            for (const node of nodes) {
                                const width = 140;
                                const height = 60;
                                if (pos.x >= node.x - width/2 && pos.x <= node.x + width/2 &&
                                    pos.y >= node.y - height/2 && pos.y <= node.y + height/2) {
                                    selectedNode = node;
                                    draggedNode = node;
                                    dragOffset.x = pos.x - node.x;
                                    dragOffset.y = pos.y - node.y;
                                    break;
                                }
                            }
                        }
                        draw();
                    });

                    canvas.addEventListener('mousemove', (e) => {
                        mousePos = getMousePos(e);

                        if (draggedNode) {
                            draggedNode.x = mousePos.x - dragOffset.x;
                            draggedNode.y = mousePos.y - dragOffset.y;
                            draw();
                        } else if (isConnecting) {
                            draw();
                        }
                    });

                    canvas.addEventListener('mouseup', (e) => {
                        if (isConnecting && connectionStart) {
                            const pos = getMousePos(e);
                            // Check if dropped on another node
                            for (const node of nodes) {
                                if (node.id !== connectionStart) {
                                    const width = 140;
                                    if (pos.x >= node.x - width/2 && pos.x <= node.x + width/2 &&
                                        pos.y >= node.y - height/2 && pos.y <= node.y + height/2) {
                                        // Create connection
                                        connections.push({
                                            id: \`conn-\${Date.now()}\`,
                                            from: connectionStart,
                                            to: node.id
                                        });
                                        break;
                                    }
                                }
                            }
                        }

                        draggedNode = null;
                        isConnecting = false;
                        connectionStart = null;
                        draw();
                    });

                    canvas.addEventListener('dblclick', (e) => {
                        const pos = getMousePos(e);
                        if (selectedNode) {
                            vscode.postMessage({
                                type: 'openFile',
                                filePath: selectedNode.path
                            });
                        }
                    });

                    // Zoom and pan
                    canvas.addEventListener('wheel', (e) => {
                        e.preventDefault();
                        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                        const mousePos = getMousePos(e);

                        const newScale = scale * zoomFactor;
                        if (newScale > 0.1 && newScale < 5) {
                            offset.x -= mousePos.x * (zoomFactor - 1) * scale;
                            offset.y -= mousePos.y * (zoomFactor - 1) * scale;
                            scale = newScale;
                            draw();
                        }
                    });

                    // Drag canvas for panning
                    let isPanning = false;
                    let panStart = { x: 0, y: 0 };

                    canvas.addEventListener('mousedown', (e) => {
                        if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+click
                            isPanning = true;
                            panStart.x = e.clientX - offset.x;
                            panStart.y = e.clientY - offset.y;
                            e.preventDefault();
                        }
                    });

                    canvas.addEventListener('mousemove', (e) => {
                        if (isPanning) {
                            offset.x = e.clientX - panStart.x;
                            offset.y = e.clientY - panStart.y;
                            draw();
                        }
                    });

                    canvas.addEventListener('mouseup', () => {
                        isPanning = false;
                    });

                    // Canvas drop handler for file drag
                    canvas.addEventListener('dragover', (e) => {
                        e.preventDefault();
                    });

                    canvas.addEventListener('drop', (e) => {
                        e.preventDefault();
                        const pos = getMousePos(e);

                        try {
                            const file = JSON.parse(e.dataTransfer.getData('application/json'));
                            addNode(file.name, pos.x, pos.y, file.type, file.path, file.size);
                        } catch (error) {
                            console.error('Error parsing dropped data:', error);
                        }
                    });

                    // Functions
                    function addNode(name, x, y, type, path, size) {
                        const node = {
                            id: \`node-\${Date.now()}\`,
                            name,
                            x,
                            y,
                            type,
                            path,
                            size
                        };
                        nodes.push(node);
                        draw();
                        return node;
                    }

                    function saveGraph() {
                        const graphData = {
                            nodes,
                            connections,
                            metadata: { scale, offset }
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

                    function clearCanvas() {
                        nodes = [];
                        connections = [];
                        selectedNode = null;
                        draw();
                    }

                    function fitToScreen() {
                        if (nodes.length === 0) return;

                        const padding = 50;
                        let minX = Infinity, maxX = -Infinity;
                        let minY = Infinity, maxY = -Infinity;

                        nodes.forEach(node => {
                            minX = Math.min(minX, node.x - 70);
                            maxX = Math.max(maxX, node.x + 70);
                            minY = Math.min(minY, node.y - 30);
                            maxY = Math.max(maxY, node.y + 30);
                        });

                        const contentWidth = maxX - minX;
                        const contentHeight = maxY - minY;

                        const scaleX = (canvas.width - 2 * padding) / contentWidth;
                        const scaleY = (canvas.height - 2 * padding) / contentHeight;
                        scale = Math.min(scaleX, scaleY, 1);

                        offset.x = canvas.width / 2 - (minX + contentWidth / 2) * scale;
                        offset.y = canvas.height / 2 - (minY + contentHeight / 2) * scale;

                        draw();
                    }

                    // File list management
                    window.updateFileList = (files) => {
                        const fileList = document.getElementById('file-list');
                        fileList.innerHTML = '';

                        files.forEach(file => {
                            const li = document.createElement('li');
                            li.className = 'file-item';
                            li.draggable = true;

                            li.innerHTML = \`
                                <div class="file-icon">\${getFileIcon(file.type)}</div>
                                <div class="file-info">
                                    <div class="file-name">\${file.name}</div>
                                    <div class="file-size">\${file.size}</div>
                                </div>
                            \`;

                            li.addEventListener('dragstart', (e) => {
                                e.dataTransfer.setData('application/json', JSON.stringify(file));
                                e.dataTransfer.effectAllowed = 'move';
                                li.classList.add('dragging');
                            });

                            li.addEventListener('dragend', () => {
                                li.classList.remove('dragging');
                            });

                            fileList.appendChild(li);
                        });
                    };

                    function getFileIcon(type) {
                        switch (type) {
                            case 'pdf': return '📄';
                            case 'database': return '🗄️';
                            case 'image': return '🖼️';
                            default: return '📄';
                        }
                    }

                    // Handle messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'filesLoaded':
                                window.updateFileList(message.files);
                                break;
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

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
