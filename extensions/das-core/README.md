# DAS Core Extension

Data Assets Studio (DAS) core functionality extension for VS Code.

## Features

### 🎯 Data Preview
- **CSV Files**: Direct tabular preview with SQL-like querying
- **Parquet Files**: Database file preview (planned)
- **Custom Editor**: Seamless integration with VS Code

### 🎨 Visual Data Weaver
- **Enhanced Canvas**: Professional node-based editor
- **File Integration**: Drag-and-drop from workspace files
- **Zoom & Pan**: Full navigation controls
- **Node Connections**: Visual relationship mapping

### 🔐 Security & Packaging
- **RSA Key Generation**: Secure key pair creation
- **Digital Signatures**: SHA256-based content signing
- **Package Verification**: Signature validation
- **Secure Storage**: Private keys stored securely

### 📋 Standards Compliance
- **Standard References**: Apply data standards
- **Metadata Tracking**: Compliance documentation

## Commands

| Command | Description |
|---------|-------------|
| `DAS: Init Workspace` | Initialize DAS workspace with manifest |
| `DAS: Open Weaver` | Launch visual data relationship editor |
| `DAS: Build Package` | Create signed DAS package (.das.gz) |
| `DAS: Generate Keys` | Create RSA key pair for signing |
| `DAS: Verify Package` | Validate package signature |
| `DAS: Apply Standard` | Set data compliance standards |

## Usage

### 1. Initialize Workspace
```bash
Ctrl+Shift+P → "DAS: Init Workspace"
```

### 2. Generate Keys (First Time)
```bash
Ctrl+Shift+P → "DAS: Generate Keys"
```

### 3. Open Data Weaver
```bash
Ctrl+Shift+P → "DAS: Open Weaver"
```

### 4. Preview Data Files
- Open CSV files directly in VS Code
- Automatic preview with table view

### 5. Build Package
```bash
Ctrl+Shift+P → "DAS: Build Package"
```

## File Structure

```
.das/
├── keys/
│   └── private.pem          # Private signing key (secure)
├── workspace/
    ├── das-manifest.json    # Project metadata
    ├── das-graph.json       # Relationship data
    ├── cert.pub             # Public key
    └── assets/              # Data files
```

## Security

- Private keys are stored in `~/.das/keys/` with restricted permissions
- Public keys are workspace-specific
- All packages are digitally signed with RSA-SHA256
- File integrity verified through SHA256 hashes

## Development

```bash
npm install
npm run compile
npm run watch
```

## Architecture

- **DataPreviewPanel**: Custom editors for data files
- **WeaverPanelEnhanced**: Visual relationship editor
- **PackagingService**: Secure package creation/verification
- **KeyManagementService**: Cryptographic key operations
