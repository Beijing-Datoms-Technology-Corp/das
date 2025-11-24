#!/bin/bash
# DAS 启动脚本
# 用于在有GUI环境的Linux系统上启动Data Assets Studio

echo "🚀 启动 Data Assets Studio (DAS)..."
echo "=================================="

# 检查是否在正确的目录
if [ ! -f "./das" ]; then
    echo "❌ 错误: 找不到DAS可执行文件，请确保在VSCode-linux-x64目录中运行此脚本"
    exit 1
fi

# 检查必要的库
echo "📋 检查系统依赖..."
MISSING_LIBS=""

if ! ldconfig -p | grep -q libgtk-3.so.0; then
    MISSING_LIBS="$MISSING_LIBS libgtk-3-0"
fi

if ! ldconfig -p | grep -q libgbm.so; then
    MISSING_LIBS="$MISSING_LIBS libgbm-dev"
fi

if ! ldconfig -p | grep -q libxss.so; then
    MISSING_LIBS="$MISSING_LIBS libxss1"
fi

if ! ldconfig -p | grep -q libasound.so; then
    MISSING_LIBS="$MISSING_LIBS libasound2"
fi

if [ -n "$MISSING_LIBS" ]; then
    echo "⚠️  警告: 缺少必要的系统库"
    echo "   请运行以下命令安装依赖:"
    echo "   sudo apt-get update"
    echo "   sudo apt-get install$MISSING_LIBS"
    echo ""
    echo "   或者运行完整安装命令:"
    echo "   sudo apt-get install libgtk-3-0 libgbm-dev libxss1 libasound2 libxrandr2 libxcomposite1 libxdamage1 libxfixes3 libatk-bridge2.0-0 libdrm2 libxkbcommon0"
    echo ""
    read -p "是否继续启动? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消启动"
        exit 1
    fi
else
    echo "✅ 系统依赖检查通过"
fi

# 检查是否有显示器
if [ -z "$DISPLAY" ]; then
    echo "⚠️  警告: 未检测到显示器环境 (\$DISPLAY 未设置)"
    echo "   如果在无GUI环境中运行，请使用 --no-sandbox 参数"
    echo "   或者使用 ./bin/das --version 来测试CLI功能"
    echo ""
    read -p "是否继续启动? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消启动"
        exit 1
    fi
fi

echo "🎯 启动DAS..."
echo "   应用程序版本: $(./bin/das --version | head -1)"
echo "   如果启动失败，请尝试添加 --no-sandbox 参数"
echo ""

# 启动应用程序
exec ./das "$@"
