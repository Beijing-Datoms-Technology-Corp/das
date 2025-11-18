# DAS 入门指南

## 欢迎使用 DAS

**DAS (Data Assets Studio)** 是专为数据资产管理而设计的垂直领域 IDE。它基于 Visual Studio Code，提供专业的数据编织、可视化管理和安全打包功能。

## 系统要求

- **操作系统**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **内存**: 至少 4GB RAM（推荐 8GB+）
- **存储**: 至少 500MB 可用空间
- **网络**: 互联网连接（用于扩展安装）

## 安装 DAS

### 方法 1: 从源码构建（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/Beijing-Datoms-Technology-Corp/das.git
cd das

# 2. 构建 DAS
./build-das.sh  # Linux/macOS
# 或
build-das.bat   # Windows

# 3. 运行构建出的应用
# 构建产物位于 ../VSCode-*/ 目录
```

### 方法 2: 下载预构建版本

访问 [GitHub Releases](https://github.com/Beijing-Datoms-Technology-Corp/das/releases) 下载最新版本。

## 首次运行

### 1. 初始化工作区

1. 打开 DAS
2. 选择或创建一个文件夹作为数据工作区
3. 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (macOS)
4. 运行命令: **"DAS: Init Workspace"**

这将在工作区创建以下文件：
- `das-manifest.json` - 项目元数据
- `das-graph.json` - 关系图数据

### 2. 生成签名密钥

```bash
# 在命令面板中运行
"DAS: Generate Keys"
```

这将创建 RSA 密钥对用于数据签名。

### 3. 验证安装

运行以下命令检查 DAS 是否正常工作：
- **"DAS: Open Weaver"** - 打开可视化编织器
- **"DAS: Build Package"** - 测试打包功能

## 界面概览

### 主界面

- **活动栏**: 左侧的图标栏，包含文件管理器、扩展等
- **侧边栏**: 文件浏览器和扩展面板
- **编辑器区域**: 主要工作区域
- **状态栏**: 底部状态信息和快捷操作

### DAS 特有功能

- **数据预览器**: 双击 CSV/Parquet 文件直接预览
- **可视化编织器**: 拖拽式数据关系编辑器
- **打包工具**: 一键生成签名数据包

## 工作流程

### 典型使用场景

1. **数据分析师**
   - 导入 CSV/Excel 数据文件
   - 使用编织器建立数据关系
   - 应用数据质量标准
   - 生成可验证的数据包

2. **数据工程师**
   - 管理 Parquet 数据集
   - 创建数据血缘图
   - 实施合规性检查
   - 构建可重现的数据流水线

3. **合规官**
   - 验证数据来源
   - 检查标准合规性
   - 审核数据包完整性
   - 生成审计报告

## 故障排除

### 常见问题

**Q: 无法打开编织器**
A: 确保已初始化工作区且生成了密钥。

**Q: 打包失败**
A: 检查密钥是否正确生成，工作区是否有必要的文件。

**Q: 数据预览显示乱码**
A: 确保文件编码为 UTF-8，文件格式正确。

**Q: 扩展无法加载**
A: 重新安装扩展或检查 Node.js 版本。

### 获取帮助

- 📖 [完整文档](./README.md)
- 🐛 [报告问题](https://github.com/Beijing-Datoms-Technology-Corp/das/issues)
- 💬 [讨论区](https://github.com/Beijing-Datoms-Technology-Corp/das/discussions)

## 下一步

- 📖 了解[编织器使用指南](./weaving-guide.md)
- 🔒 学习[安全机制](./security.md)
- 📦 查看[格式规范](./format-spec.md)
