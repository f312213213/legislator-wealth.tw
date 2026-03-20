# 立委持股公開平台

台灣第十一屆立法委員的股票及基金申報資料公開透明平台。

資料來源為[監察院公報](https://www.cy.gov.tw/)，市值依據台灣證交所收盤價估算。

**網站：[legislator-wealth.tw](https://legislator-wealth.tw)**

## 資料範圍

- 股票（八.1 股票）
- 基金受益憑證（八.3 基金受益憑證）
- 變動財產申報表中的股票交易紀錄

其他財產類別（不動產、存款、債務等）不在本站範圍內。

## 技術架構

- **Next.js 16** — App Router, 靜態匯出 (`output: 'export'`)
- **shadcn/ui** — Base UI preset, `--radius: 0`
- **Tailwind CSS 4**
- **pdfjs-dist** — PDF 文字擷取
- **Cloudflare Pages** — 靜態部署

## 資料處理流程

```
監察院公報 PDF → parse-pdf.ts → JSON → build-index.ts → Next.js SSG → 靜態 HTML
```

1. `scripts/parse-pdf.ts` — 解析監察院公報 PDF，擷取股票及基金持有資料
2. `scripts/build-index.ts` — 建立立委索引，產生拼音路由 slug
3. `scripts/fetch-legislators.ts` — 從立法院官網擷取立委照片及黨籍資料
4. `scripts/generate-og.ts` — 產生每位立委的 Open Graph 社群預覽圖片

## 開發

```bash
pnpm install
pnpm dev
```

## 資料更新

將監察院公報 PDF 放入 `raw-pdfs/` 目錄，然後執行：

```bash
pnpm run grab-data
```

這會依序執行：
1. 從立法院官網擷取立委照片及黨籍
2. 解析所有 PDF 並產生 JSON
3. 建立索引

## 股價資料

將以下檔案放入 `data/` 目錄以啟用市值估算：

- `STOCK_DAY_ALL.json` — 台灣證交所上市股票收盤價
- `tpex_mainboard_quotes.json` — 櫃買中心上櫃股票報價
- `tpex_esb_latest_statistics.json` — 興櫃股票最新統計

查找順序：TWSE → TPEx → ESB，支援模糊比對（去除 `＊`、`*`、`-KY` 等後綴）。

## 建置與部署

```bash
pnpm run build
```

產出靜態檔案至 `out/` 目錄，部署至 Cloudflare Pages。

## 可用指令

| 指令 | 說明 |
|---|---|
| `pnpm dev` | 啟動開發伺服器 |
| `pnpm build` | 建置靜態網站 |
| `pnpm run parse` | 解析 PDF 並建立索引 |
| `pnpm run fetch-legislators` | 擷取立委照片及黨籍 |
| `pnpm run grab-data` | 一次執行所有資料更新 |

## 已知限制

- 部分立委尚無公開申報紀錄，故未列出
- PDF 文字擷取依賴 pdfjs-dist，部分特殊字元可能遺失（如 `陳秀寳` 的 `寳`）
- 基金名稱因 PDF 跨行排版可能不完整
- 約 10% 的股票因下市或為海外股票，無法取得即時市價

## 回報問題

資料由程式自動解析申報 PDF，若有錯誤歡迎[開 Issue](https://github.com/f312213213/legislator-wealth.tw/issues) 回報。

## 授權

MIT
