# DAS: Data Assets Studio - Build Guide

## Overview

This guide explains how to build the complete DAS IDE from source, including all custom extensions and modifications.

## Prerequisites

- Node.js 16.x or later
- npm or yarn
- Python 3.x (for node-gyp)
- Git
- Build tools for your platform:
  - **Windows**: Visual Studio Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: build-essential package

## Quick Build

### Linux/macOS
```bash
# Make sure you're in the DAS root directory
cd /path/to/das

# Run the automated build script
./build-das.sh
```

### Windows
```batch
REM Make sure you're in the DAS root directory
cd C:\path\to\das

REM Run the automated build script
build-das.bat
```

## Manual Build Steps

If the automated script fails, you can build manually:

### Step 1: Install Dependencies
```bash
# Install root dependencies
npm install

# Install das-core extension dependencies
cd extensions/das-core
npm install
cd ../..
```

### Step 2: Build Extensions
```bash
# Compile das-core extension
cd extensions/das-core
npm run compile
cd ../..
```

### Step 3: Run Hygiene Checks
```bash
# Optional: Run code quality checks
npm run hygiene
```

### Step 4: Build IDE
```bash
# Build for your platform
# Linux x64
npm run gulp vscode-linux-x64

# macOS
npm run gulp vscode-darwin

# Windows x64
npm run gulp vscode-win32-x64

# Windows ARM64
npm run gulp vscode-win32-arm64
```

## Build Configuration

### Built-in Extensions

DAS includes the following built-in extensions (configured in `product.json`):

- `ms-vscode.js-debug-companion`
- `ms-vscode.js-debug`
- `ms-vscode.vscode-js-profile-table`
- **`das-core`** (DAS custom extension)

### Product Configuration

Key modifications in `product.json`:
- `nameShort`: "DAS"
- `nameLong`: "Data Assets Studio"
- `applicationName`: "das"
- `dataFolderName`: ".das"

## Output

Build artifacts are generated in platform-specific directories:
- **Linux**: `../VSCode-linux-x64/`
- **macOS**: `../VSCode-darwin/`
- **Windows**: `../VSCode-win32-x64/`

## Troubleshooting

### Common Issues

1. **Node.js Version**
   ```bash
   node --version  # Should be 16.x or later
   ```

2. **Python Version**
   ```bash
   python --version  # Should be 3.x
   ```

3. **Build Tools Missing**
   - **Ubuntu/Debian**: `sudo apt-get install build-essential`
   - **CentOS/RHEL**: `sudo yum groupinstall "Development Tools"`
   - **macOS**: `xcode-select --install`
   - **Windows**: Install Visual Studio Build Tools

4. **Extension Build Fails**
   ```bash
   cd extensions/das-core
   npm run compile  # Check for TypeScript errors
   ```

5. **Permission Issues**
   ```bash
   # Ensure proper permissions
   chmod +x build-das.sh
   ```

### Build Logs

Check the following for detailed error information:
- Console output during build
- `npm-debug.log` files
- Build artifacts in the output directory

## Distribution

After successful build:

1. **Package the build output** into an installer
2. **Test the installation** on a clean machine
3. **Verify DAS functionality**:
   - Workspace initialization
   - Data preview (CSV/Parquet)
   - Visual weaving
   - Package building and verification

## Advanced Configuration

### Custom Build Options

You can modify the gulp tasks in the root `package.json` or create custom build configurations.

### Development Builds

For development, you can use:
```bash
# Quick compile without full packaging
npm run gulp compile-build
```

### Extension Development

To work on extensions during development:
```bash
# Watch mode for extension recompilation
cd extensions/das-core
npm run watch
```

## Support

If you encounter build issues:

1. Check this documentation
2. Review VS Code build documentation
3. Check GitHub issues for similar problems
4. Ensure all prerequisites are met

## Release Process

1. **Update version numbers** in `package.json` and `product.json`
2. **Tag the release** in git
3. **Build on all target platforms**
4. **Test installations** thoroughly
5. **Create release artifacts** and documentation
