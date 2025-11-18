# DAS 数据格式规范

## 概述

DAS 定义了一套标准的数据资产打包格式，确保数据包的可移植性、安全性和可验证性。本规范详细描述了 `.das.gz` 文件的内部结构和格式要求。

## 文件格式总览

### 外部格式
- **扩展名**: `.das.gz`
- **压缩算法**: GZIP
- **内部格式**: TAR 归档
- **字符编码**: UTF-8

### 内部结构
```
data.das.gz (GZIP 压缩)
└── data.tar (TAR 归档)
    ├── manifest.json       # 项目元数据
    ├── graph.json         # 关系图数据
    ├── assets/            # 数据资产目录
    │   ├── data.csv
    │   ├── report.pdf
    │   └── ...
    ├── hashes.json        # 完整性哈希
    └── _signature.sig     # 数字签名
```

## 核心文件规范

### 1. manifest.json

项目元数据和基本信息。

#### 必需字段
```json
{
  "name": "string",           // 项目名称
  "version": "string",        // 版本号 (语义化版本)
  "description": "string",    // 项目描述
  "created": "string",        // 创建时间 (ISO 8601)
  "standard_ref": "string"    // 数据标准引用 (可选)
}
```

#### 可选字段
```json
{
  "updated": "string",        // 最后更新时间
  "author": "string",         // 作者信息
  "license": "string",        // 许可证
  "tags": ["string"],         // 标签数组
  "metadata": {               // 扩展元数据
    "custom_field": "value"
  }
}
```

### 2. graph.json

数据关系图定义。

#### 基本结构
```json
{
  "nodes": [
    {
      "id": "string",           // 唯一标识符
      "name": "string",         // 显示名称
      "type": "string",         // 节点类型: "pdf"|"database"|"document"|"image"
      "path": "string",         // 相对文件路径
      "size": "string",         // 文件大小 (人类可读格式)
      "x": number,              // 画布 X 坐标
      "y": number               // 画布 Y 坐标
    }
  ],
  "connections": [
    {
      "id": "string",           // 连接唯一标识符
      "from": "string",         // 源节点 ID
      "to": "string",           // 目标节点 ID
      "type": "string"          // 关系类型 (可选)
    }
  ],
  "metadata": {
    "scale": number,           // 画布缩放比例
    "offset": {                // 画布偏移
      "x": number,
      "y": number
    }
  }
}
```

### 3. assets/ 目录

存放所有原始数据文件。

#### 文件组织
- **相对路径**: 保持原始工作区结构
- **目录递归**: 支持多级目录结构
- **文件过滤**: 自动排除 `.das-*` 和 `node_modules`

#### 支持的文件类型
- **文档**: PDF, DOC, DOCX, TXT, MD
- **数据**: CSV, TSV, JSON, XML, Parquet
- **图片**: PNG, JPG, JPEG, GIF, SVG, WebP
- **其他**: XLS, XLSX, ZIP (视具体需求)

### 4. hashes.json

文件完整性验证数据。

#### 格式规范
```json
{
  "relative/path/to/file1": "sha256_hash_hex_string",
  "relative/path/to/file2": "sha256_hash_hex_string",
  "data.csv": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
  "report.pdf": "b614a1c4e4e7b4e8f2a6b4c2f3a8b1e4c7d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4"
}
```

#### 计算规则
- **算法**: SHA256
- **输入**: 文件原始二进制内容
- **输出**: 64 字符十六进制字符串
- **排序**: 按路径字符串字典序排序

### 5. _signature.sig

RSA 数字签名文件。

#### 格式规范
- **内容**: Base64 编码的签名数据
- **算法**: RSA-SHA256 (RSASSA-PKCS1-v1_5)
- **密钥**: 2048 位 RSA 私钥
- **签名对象**: `hashes.json` 的排序哈希字符串

#### 签名计算过程
```javascript
// 1. 读取 hashes.json
const hashes = JSON.parse(fs.readFileSync('hashes.json'));

// 2. 生成排序的哈希字符串
const hashString = Object.entries(hashes)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, hash]) => `${path}:${hash}`)
  .join('\n');

// 3. 使用私钥签名
const signature = crypto.sign('RSA-SHA256', Buffer.from(hashString), privateKey);

// 4. Base64 编码后写入文件
fs.writeFileSync('_signature.sig', signature.toString('base64'));
```

## 验证算法

### 完整性验证流程

```javascript
function verifyPackage(packagePath, publicKeyPath) {
  // 1. 解压包
  // 2. 读取签名
  const signature = fs.readFileSync('_signature.sig', 'utf8');

  // 3. 重新计算哈希
  const files = getAllAssetFiles();
  const calculatedHashes = {};
  for (const file of files) {
    const content = fs.readFileSync(`assets/${file}`);
    calculatedHashes[file] = crypto.createHash('sha256').update(content).digest('hex');
  }

  // 4. 生成验证字符串
  const hashString = Object.entries(calculatedHashes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, hash]) => `${path}:${hash}`)
    .join('\n');

  // 5. 验证签名
  const publicKey = fs.readFileSync(publicKeyPath);
  const isValid = crypto.verify('RSA-SHA256', Buffer.from(hashString), publicKey, Buffer.from(signature, 'base64'));

  return isValid;
}
```

## 扩展机制

### 自定义元数据

Manifest 和 Graph 文件支持扩展字段：

```json
{
  "custom_metadata": {
    "organization": "Example Corp",
    "department": "Data Science",
    "classification": "Internal"
  }
}
```

### 关系类型扩展

支持自定义关系类型：

```json
{
  "connections": [
    {
      "from": "data.csv",
      "to": "report.pdf",
      "type": "custom_relationship",
      "properties": {
        "strength": 0.8,
        "description": "Primary data source"
      }
    }
  ]
}
```

## 工具和库

### 推荐实现

#### JavaScript/Node.js
```javascript
// 打包
const tar = require('tar-stream');
const zlib = require('zlib');
const crypto = require('crypto');

// 解包和验证
const fs = require('fs');
const path = require('path');
```

#### Python
```python
# 打包和验证
import tarfile
import gzip
import hashlib
import cryptography
```

### 第三方库

#### 必需
- **tar-stream**: TAR 归档处理
- **zlib**: GZIP 压缩/解压

#### 可选
- **parquetjs-lite**: Parquet 文件支持
- **papaparse**: CSV 解析增强

## 兼容性要求

### 版本控制
- **格式版本**: manifest.json 中的 `format_version` 字段
- **向后兼容**: 新版本应兼容旧格式
- **迁移工具**: 提供格式升级脚本

### 平台兼容性
- **操作系统**: Windows, macOS, Linux
- **文件系统**: 支持 Unicode 路径
- **压缩兼容**: 标准 GZIP/TAR 实现

## 安全考虑

### 数据保护
- 敏感数据文件应预先加密
- 考虑使用额外的对称加密层
- 支持密码保护的包格式

### 传输安全
- 推荐使用 TLS/HTTPS 传输
- 支持包的 PGP 签名 (扩展)
- 考虑端到端加密方案

## 性能优化

### 大文件处理
- **流式处理**: 避免内存溢出
- **增量哈希**: 支持大文件哈希计算
- **并行处理**: 多核 CPU 利用

### 压缩优化
- **压缩级别**: 平衡速度和压缩率
- **分块压缩**: 支持超大文件
- **重复数据删除**: 检测和优化重复内容

## 测试和验证

### 合规性测试
```bash
# 包创建测试
npm test -- --grep "packaging"

# 签名验证测试
npm test -- --grep "signature"

# 完整性检查测试
npm test -- --grep "integrity"
```

### 互操作性测试
- 跨平台包创建和验证
- 不同工具间的兼容性
- 网络传输完整性

## 相关链接

- [入门指南](./getting-started.md)
- [编织器使用](./weaving-guide.md)
- [安全机制](./security.md)
- [API 文档](../extensions/das-core/README.md)
