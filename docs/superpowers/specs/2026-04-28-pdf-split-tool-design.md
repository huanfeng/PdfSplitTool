# PDF 分割工具 — 设计规格

**日期：** 2026-04-28  
**状态：** 已批准  
**技术栈：** React 18 + Vite · pdfjs-dist · pdf-lib · Zustand · JSZip

---

## 1. 项目目标

构建一个**纯前端** Web 应用，无需服务器，无需上传文件。用户可将 A3（及其他宽幅）PDF 分割为 A4 大小以便打印试卷，支持可视化拖拽分割线预览，支持多种批量分割模式，最终导出为 PDF 文件。

---

## 2. 功能范围

### 2.1 核心功能

- **文件导入**：拖放或点击上传本地 PDF 文件，纯浏览器端读取，不上传服务器
- **页面预览**：用 PDF.js 将每页渲染到 Canvas，左侧显示所有页面缩略图
- **分割线交互**：在当前页 Canvas 上叠加 SVG 层，提供可拖拽分割线 + 圆形手柄，实时显示两侧比例百分比
- **分割方向**：支持左右分割（竖线）和上下分割（横线），可按页配置
- **批量模式**：分级覆盖机制（见 2.2）
- **导出**：单个合并 PDF 或多 PDF 打包 ZIP，两种方式均可选

### 2.2 分级覆盖配置（优先级从低到高）

| 优先级 | 层级 | 说明 |
|--------|------|------|
| 1（最低）| 全局配置 | 所有页面的默认分割比例和方向 |
| 2 | 奇偶页配置 | 分别为奇数页、偶数页设置不同比例，用于处理装订边 |
| 3 | 页范围配置 | 指定页码范围（如第 3-10 页）使用特定比例 |
| 4（最高）| 逐页配置 | 单独为某一页设置精确比例 |

高优先级配置完全覆盖低优先级，不做合并。

### 2.3 明确排除

- 不支持多文件同时处理
- 不支持 PDF 内容编辑（文字、注释等）
- 不支持 OCR
- 不支持打印直连（由浏览器打印功能承担）

---

## 3. 整体架构

```
┌─────────────────────────────────────────────┐
│  UI 层（React Components）                   │
│  Header · PageList · SplitCanvas · ConfigPanel │
├─────────────────────────────────────────────┤
│  状态层（Zustand Store）                     │
│  pdfDoc · splitConfigs（4层）· history       │
├─────────────────────────────────────────────┤
│  服务层（纯函数模块，src/services/）          │
│  pdfRenderer · splitConfigResolver           │
│  pdfSplitter · exportBuilder                 │
├─────────────────────────────────────────────┤
│  第三方库                                    │
│  pdfjs-dist · pdf-lib · jszip                │
└─────────────────────────────────────────────┘
```

**数据流：**
① 拖入 PDF → ② PDF.js 解析 → ③ 渲染缩略图 → ④ 选页 + 拖分割线 → ⑤ 更新 splitConfigs → ⑥ pdf-lib 生成输出 → ⑦ Blob 下载

---

## 4. 界面布局

聚焦预览布局：顶部 Header 条 + 下方三列主体（PageList · SplitCanvas · ConfigPanel）：

```
┌──────────────────────────────────────────────┐
│  Header：文件名 · 页码导航 · 撤销/重做        │
├────────┬──────────────────────┬──────────────┤
│        │                      │              │
│ Page   │   SplitCanvas        │ ConfigPanel  │
│ List   │   <canvas> +         │ 分割方向     │
│ 110px  │   <svg overlay>      │ 批量模式     │
│ 缩略图 │   分割线 + 手柄      │ 比例输入     │
│        │   比例标注           │ 导出按钮     │
│        │                      │ 140px        │
└────────┴──────────────────────┴──────────────┘
```

---

## 5. 组件设计

### `<Header />`
- 文件拖放上传区（无文件时占全屏，有文件后收起为顶栏）
- 文件名显示
- 页码导航（上一页 / 下一页 / 跳转输入）
- 撤销（Ctrl+Z）/ 重做（Ctrl+Y）按钮

### `<PageList />`
- 竖向滚动缩略图列表
- 每张缩略图叠加当前分割线位置（细线）
- 点击跳转对应页
- 已单独配置的页面显示彩色角标

### `<SplitCanvas />`
- `<canvas>` 渲染当前页，`<svg>` 绝对定位叠加（pointer-events 仅在手柄区域生效）
- 分割线：SVG `<line>`，可拖动手柄：SVG `<circle>`
- 拖动时实时更新比例，松开时写入 Store 并推历史快照
- 支持左右（ew-resize）和上下（ns-resize）两种方向
- 键盘微调：方向键 ±0.5%，Shift+方向键 ±5%

### `<ConfigPanel />`
- 分割方向切换（左右 / 上下）
- 批量模式选择：统一比例 · 奇偶页 · 页范围 · 当前页
- 精确比例数值输入框（支持键盘输入）
- "应用到当前页" / "应用到所有奇数页" / "应用到所有页" 快捷按钮
- 页范围输入（起始页 - 结束页）
- 导出区：单文件 PDF 下载 · ZIP 下载，导出时显示进度

---

## 6. 状态结构（Zustand）

```typescript
interface SplitConfig {
  ratio: number          // 0.0 ~ 1.0，分割线相对于页面宽/高的位置
  direction: 'horizontal' | 'vertical'  // 左右分 | 上下分
}

interface PDFStore {
  // 文件
  pdfDoc: PDFDocumentProxy | null
  pdfBytes: ArrayBuffer | null
  pageCount: number
  currentPage: number            // 1-based

  // 分级配置
  globalConfig: SplitConfig
  oddEvenConfig: { odd?: SplitConfig; even?: SplitConfig }
  rangeConfigs: Array<{ from: number; to: number; config: SplitConfig }>
  pageConfigs: Map<number, SplitConfig>

  // 渲染缓存
  thumbnailCache: Map<number, ImageBitmap>

  // 撤销/重做
  history: ConfigSnapshot[]      // 仅快照 4 层配置，不含缓存
  historyIndex: number
}

interface ConfigSnapshot {
  globalConfig: SplitConfig
  oddEvenConfig: { odd?: SplitConfig; even?: SplitConfig }
  rangeConfigs: Array<{ from: number; to: number; config: SplitConfig }>
  pageConfigs: Map<number, SplitConfig>
}
```

---

## 7. 服务层

### `splitConfigResolver.ts`

纯函数，给定页码返回最终生效配置：

```typescript
function resolveConfig(pageNum: number, store: PDFStore): SplitConfig {
  let cfg = store.globalConfig
  const oe = pageNum % 2 === 1 ? store.oddEvenConfig.odd : store.oddEvenConfig.even
  if (oe) cfg = oe
  const range = store.rangeConfigs.findLast(r => pageNum >= r.from && pageNum <= r.to)
  if (range) cfg = range.config
  const perPage = store.pageConfigs.get(pageNum)
  if (perPage) cfg = perPage
  return cfg
}
```

### `pdfRenderer.ts`

- 封装 `pdfjs-dist`，提供 `renderPage(pageNum, canvas, scale)` 和 `renderThumbnail(pageNum)` 接口
- 缓存已渲染的 ImageBitmap，避免重复渲染
- PDF.js Worker 通过 `pdfjsLib.GlobalWorkerOptions.workerSrc` 配置

### `pdfSplitter.ts`

核心分割逻辑（基于 pdf-lib CropBox）：

```
对每个原始页面 P（共 N 页）：
  1. 从 pdfBytes 加载 PDFDocument
  2. resolveConfig(P) 得到 { ratio, direction }
  3. 获取页面原始 MediaBox: [x0, y0, x1, y1]
  4. 按 direction 和 ratio 计算两个 CropBox：
     - vertical（左右分）：
       leftBox  = [x0, y0, x0 + (x1-x0)*ratio, y1]
       rightBox = [x0 + (x1-x0)*ratio, y0, x1, y1]
     - horizontal（上下分）：
       topBox    = [x0, y0 + (y1-y0)*(1-ratio), x1, y1]
       bottomBox = [x0, y0, x1, y0 + (y1-y0)*(1-ratio)]
  5. 克隆页面两次，分别设置 CropBox
  6. 写入输出 PDFDocument（交叉顺序：1左,1右,2左,2右...）
```

**CropBox 说明：** pdf-lib 的 `page.setCropBox()` 仅改变"可见窗口"元数据，不重新编码内容，保留完整矢量质量。

### `exportBuilder.ts`

- **单文件模式**：将 `pdfSplitter` 输出的所有页面合并为一个 PDFDocument，调用 `doc.save()` 生成 `Uint8Array`，用 `URL.createObjectURL(new Blob(...))` 触发下载
- **ZIP 模式**：每个原始页面的分割结果生成一个 PDF 文件（`page-01.pdf`...），用 JSZip 打包后下载

---

## 8. 关键交互细节

### 8.1 SVG 分割线拖动

```
<div style="position:relative">
  <canvas ref={canvasRef} />
  <svg style="position:absolute;inset:0;pointer-events:none" ref={svgRef}>
    <line ... stroke="#e94560" strokeWidth={2} />
    <circle ... style={{pointerEvents:'all', cursor: direction==='vertical' ? 'ew-resize' : 'ns-resize'}}
      onMouseDown={startDrag} />
  </svg>
</div>
```

拖动流程：`mousedown` 在 circle → 监听 `window mousemove/mouseup`（防止拖出边界丢失）→ 计算相对 Canvas 的比例 → 实时更新 SVG line 位置 → `mouseup` 时 dispatch 到 Store + 推历史快照。

### 8.2 页面缩放适配

Canvas 渲染时根据容器宽度计算 `scale = containerWidth / page.view[2]`，SVG 与 Canvas 共享同一宽高，分割线坐标直接用 `ratio * canvasWidth`，无坐标系转换问题。

### 8.3 导出页面顺序

默认交叉排列（适合阅读顺序）：`1A, 1B, 2A, 2B, ...`。ConfigPanel 提供切换选项支持顺序排列：`1A, 2A, ..., 1B, 2B, ...`。

---

## 9. 目录结构

```
pdf-split-tool/
├── src/
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── PageList.tsx
│   │   ├── SplitCanvas.tsx
│   │   └── ConfigPanel.tsx
│   ├── services/
│   │   ├── pdfRenderer.ts
│   │   ├── splitConfigResolver.ts
│   │   ├── pdfSplitter.ts
│   │   └── exportBuilder.ts
│   ├── store/
│   │   └── usePDFStore.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── pdf.worker.min.js    # pdfjs worker
├── index.html
├── vite.config.ts
└── package.json
```

---

## 10. 依赖清单

| 包 | 版本约束 | 用途 |
|----|---------|------|
| react | ^18 | UI 框架 |
| pdfjs-dist | ^4 | PDF 渲染 |
| pdf-lib | ^1.17 | PDF 输出 |
| zustand | ^4 | 状态管理 |
| jszip | ^3 | ZIP 打包 |
| vite | ^5 | 构建工具 |
| typescript | ^5 | 类型安全 |

---

## 11. 不在本期范围内（后续可迭代）

- Web Worker 异步处理（适用于 100 页以上大文件）
- 移动端触屏拖拽支持
- 导出前打印预览
- 配置方案保存/加载（localStorage）
