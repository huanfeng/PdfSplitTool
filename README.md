# PDF Splitter

纯浏览器端的 PDF 分割工具，将 A3 等宽幅 PDF 按比例切分为 A4 大小，文件不离开本地设备。

## 特性

- 🎯 **可视化分割**：拖动分割线实时预览，精度 0.1%，支持左右 / 上下两个方向
- 📐 **矢量切分**：基于 pdf-lib CropBox + MediaBox，保留矢量质量，不光栅化
- 📋 **四级批量配置**：统一比例 / 奇偶页 / 页范围 / 逐页，级联优先级覆盖
- 📦 **灵活导出**：合并为单 PDF 或按页打包成 ZIP
- ↩ **撤销重做**：50 步历史栈，`Ctrl+Z` / `Ctrl+Y`
- 🔍 **预览缩放**：悬浮工具条 + `Ctrl/Alt + 滚轮`
- ⚡ **渲染质量**：标准 / 高清 2× 可选
- 🎨 **暗黑/亮色主题**
- 💾 **配置持久化**：分割偏好与主题自动保存到 localStorage

## 快速开始

```bash
pnpm install
pnpm dev          # 启动开发服务器
pnpm build        # 生产构建
pnpm test         # 运行单元测试
```

## 技术栈

- **React 19** + **TypeScript** + **Vite 8**
- **pdfjs-dist** — PDF 渲染（Web Worker）
- **pdf-lib** — PDF 元数据切分（CropBox/MediaBox）
- **Zustand** — 状态管理 + 撤销重做
- **JSZip** — 多页 ZIP 打包

## 目录结构

```
src/
├── components/         # React 组件
│   ├── Header          # 顶栏：导航、主题、文件操作
│   ├── LandingPage     # 入口页
│   ├── PageList        # 缩略图列表
│   ├── SplitCanvas     # 预览画布 + 分割线交互
│   └── ConfigPanel     # 配置面板（模式、比例、导出）
├── store/              # Zustand store
├── services/           # 业务逻辑
│   ├── pdfRenderer            # pdfjs 渲染封装
│   ├── pdfSplitter            # pdf-lib 切分逻辑
│   ├── splitConfigResolver    # 级联配置优先级
│   └── exportBuilder          # 单 PDF / ZIP 导出
└── types/              # 类型定义
```

## 工作原理

1. 上传时通过 pdfjs-dist 加载 PDF 到 Web Worker，主线程保留原始 ArrayBuffer
2. 预览页用 canvas 渲染，SVG 叠加层处理拖拽与比例标注
3. 导出时 pdf-lib 按比例为每页设置 CropBox + MediaBox 生成左右两页
4. 配置遵循 `pageConfigs > rangeConfigs > oddEvenConfig > globalConfig` 优先级

## 快捷键

| 按键 | 功能 |
|------|------|
| `← / →` 或 `↑ / ↓` | 微调分割线（0.5%） |
| `Shift + 方向键` | 大步微调（5%） |
| `Ctrl/⌘ + Z` | 撤销 |
| `Ctrl/⌘ + Y` 或 `Ctrl + Shift + Z` | 重做 |
| `Ctrl/Alt + 滚轮` | 缩放预览 |

## 许可

MIT
