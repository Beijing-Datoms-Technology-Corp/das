# Data Assets Studio (DAS) - Linux 版本

## 📦 构建信息
- **版本**: 1.107.20251119
- **构建时间**: 2025-11-24
- **平台**: Linux x64
- **构建者**: Ubuntu 22.04 环境

## 🚀 快速启动

### 方法1: 一键启动脚本 (推荐)
```bash
cd VSCode-linux-x64
./start-das.sh
```

### 方法2: 直接运行
```bash
cd VSCode-linux-x64
./das
```

### 方法3: CLI工具
```bash
cd VSCode-linux-x64
./bin/das --help
./bin/das --version
```

## 🔧 系统依赖安装

### Ubuntu/Debian
```bash
# 更新包列表
sudo apt-get update

# 安装DAS所需的GUI库
sudo apt-get install -y libgtk-3-0 libgbm-dev libxss1 libasound2 libxrandr2 libxcomposite1 libxdamage1 libxfixes3 libatk-bridge2.0-0 libdrm2 libxkbcommon0

# 可选: 安装中文字体支持
sudo apt-get install -y fonts-wqy-zenhei fonts-wqy-microhei
```

### CentOS/RHEL
```bash
sudo yum install -y gtk3 libXScrnSaver alsa-lib libXrandr libXcomposite libXdamage libXfixes atk bridge mesa-libgbm
```

### Fedora
```bash
sudo dnf install -y gtk3 libXScrnSaver alsa-lib libXrandr libXcomposite libXdamage libXfixes atk bridge mesa-libgbm
```

## 📁 目录结构
```
VSCode-linux-x64/
├── das                    # 主可执行文件 (191MB)
├── start-das.sh          # 🚀 智能启动脚本
├── README-DAS.md         # 📖 本文档
├── bin/
│   └── das               # CLI工具
├── resources/
│   └── app/
│       ├── product.json  # DAS配置
│       └── out/          # 编译后的代码
├── locales/              # 本地化文件 (140+ 语言)
└── *.so                  # 系统库文件
```

## ⚙️ 应用程序信息

### 基本信息
- **应用程序名称**: das
- **显示名称**: Data Assets Studio
- **简称**: DAS
- **版本**: 1.107.20251119

### 内置扩展
- **das-core**: DAS核心功能扩展

### 配置文件
```json
{
  "nameShort": "DAS",
  "nameLong": "Data Assets Studio",
  "applicationName": "das",
  "dataFolderName": ".das"
}
```

## 🎯 启动选项

### GUI模式启动
```bash
./das                          # 正常启动
./das --no-sandbox            # 无沙箱模式 (受限环境)
./das --disable-gpu           # 禁用GPU加速
./das --verbose               # 详细日志
./das /path/to/folder         # 打开指定文件夹
./das file.txt:10             # 打开文件并跳转到第10行
```

### 命令行模式
```bash
./bin/das --version           # 显示版本信息
./bin/das --help              # 显示帮助信息
./bin/das --diff file1.txt file2.txt  # 比较文件
./bin/das --list-extensions   # 列出扩展
```

## 🐛 故障排除

### 问题1: "error while loading shared libraries: libgtk-3.so.0"
**原因**: 缺少GTK库
**解决**:
```bash
sudo apt-get install libgtk-3-0
```

### 问题2: "Missing X server or $DISPLAY"
**原因**: 没有GUI环境
**解决**:
```bash
# 方案1: 使用VNC或类似工具连接GUI
# 方案2: 使用 --no-sandbox 参数 (可能功能受限)
./das --no-sandbox
# 方案3: 使用CLI工具验证
./bin/das --version
```

### 问题3: "The platform failed to initialize"
**原因**: GUI系统初始化失败
**解决**:
```bash
# 检查显示器设置
echo $DISPLAY
# 安装必要的X11库
sudo apt-get install x11-utils x11-xserver-utils
```

### 问题4: 中文显示乱码
**解决**:
```bash
sudo apt-get install fonts-wqy-zenhei fonts-wqy-microhei
```

### 问题5: 启动脚本检查失败
**原因**: 系统库不完整
**解决**: 运行完整的依赖安装命令

## 📊 性能优化

### 内存使用
- 默认情况下，DAS会使用系统可用内存
- 可以通过 `--max-memory=4096` 限制内存使用 (MB)

### GPU加速
- 默认启用GPU加速以提高性能
- 如遇问题可使用 `--disable-gpu` 禁用

## 🔐 安全注意事项

- DAS基于Electron框架构建
- `--no-sandbox` 参数会降低安全性，仅在必要时使用
- 建议在受信任的环境中运行

## 📞 技术支持

### 验证安装
```bash
# 检查版本
./bin/das --version

# 检查扩展
./bin/das --list-extensions

# 检查配置
cat resources/app/product.json | grep nameShort
```

### 日志查看
```bash
# 启用详细日志
./das --verbose 2>&1 | tee das.log

# 查看错误日志
dmesg | grep -i das
```

---
*DAS构建完成时间: 2025-11-24*
*构建环境: Ubuntu 22.04 LTS (AWS EC2)*
*Electron版本: 39.2.0*
