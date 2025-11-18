#!/usr/bin/env bash

# DAS: Data Assets Studio Build Script
# This script builds the complete DAS IDE with all extensions

set -e

echo "🚀 Starting DAS Build Process..."
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory and root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}Build root: $ROOT${NC}"

# Check if we're in the right directory
if [ ! -f "$ROOT/package.json" ] || [ ! -f "$ROOT/product.json" ]; then
    echo -e "${RED}Error: Not in DAS root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Installing root dependencies...${NC}"
cd "$ROOT"
npm install

echo -e "${YELLOW}Step 2: Building das-core extension...${NC}"
cd "$ROOT/extensions/das-core"

if [ ! -d "node_modules" ]; then
    echo "Installing das-core dependencies..."
    npm install
fi

echo "Compiling das-core extension..."
npm run compile

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to compile das-core extension${NC}"
    exit 1
fi

echo -e "${GREEN}✓ das-core extension built successfully${NC}"

# Return to root
cd "$ROOT"

echo -e "${YELLOW}Step 3: Running hygiene checks...${NC}"
npm run hygiene

echo -e "${YELLOW}Step 4: Starting main build process...${NC}"

# Detect platform and set appropriate gulp task
PLATFORM=""
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="darwin"
    GULP_TASK="vscode-darwin"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    PLATFORM="win32"
    GULP_TASK="vscode-win32-x64"
else
    PLATFORM="linux"
    GULP_TASK="vscode-linux-x64"
fi

echo -e "${BLUE}Detected platform: $PLATFORM${NC}"
echo -e "${BLUE}Using gulp task: $GULP_TASK${NC}"

# Run the build
echo "Running gulp build (this may take several minutes)..."
npm run gulp $GULP_TASK

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 DAS Build Completed Successfully!${NC}"
echo ""
echo -e "${BLUE}Built artifacts should be available in the build output directory${NC}"
echo -e "${BLUE}You can now distribute the DAS IDE installer${NC}"
