# Flower Shop Backend

花卉電商平台後端服務，提供完整的購物流程（商品瀏覽 → 加入購物車 → 結帳下單 → 模擬付款）以及管理者後台（商品管理、訂單查詢）。前台採用 EJS 伺服器端渲染，API 層遵循 RESTful 設計，所有回應均為統一 JSON 格式。

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 執行環境 | Node.js（CommonJS 模組） |
| Web 框架 | Express 4.x |
| 資料庫 | SQLite 3（better-sqlite3，同步 API） |
| 樣板引擎 | EJS 5.x |
| CSS 框架 | Tailwind CSS 4.x（CLI 編譯） |
| 認證 | JWT（jsonwebtoken）+ bcrypt 密碼雜湊 |
| UUID 生成 | uuid v4 |
| API 文件 | swagger-jsdoc（從 JSDoc 生成 OpenAPI 3.0） |
| 測試框架 | Vitest 2.x + supertest |

---

## 快速開始

```bash
# 1. 安裝相依套件
npm install

# 2. 設定環境變數
cp .env.example .env
# 編輯 .env，至少填入有效的 JWT_SECRET

# 3. 啟動開發伺服器（需先確保 CSS 已建置，或另開終端機執行 dev:css）
npm run dev:server

# 4. 瀏覽前台首頁
open http://localhost:3001
```

若需要同步監看 CSS 變更，開兩個終端機分別執行：

```bash
# 終端機 1
npm run dev:css

# 終端機 2
npm run dev:server
```

生產環境一鍵啟動（CSS 建置 + 伺服器）：

```bash
npm start
```

---

## 預設帳號

資料庫初始化時會自動 seed 一組管理員帳號（可透過 `.env` 覆寫）：

| 欄位 | 預設值 |
|------|--------|
| Email | `admin@hexschool.com` |
| Password | `12345678` |
| Role | `admin` |

---

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm start` | 建置 CSS（minify）後啟動伺服器 |
| `npm run dev:server` | 直接啟動 Express（不重建 CSS） |
| `npm run dev:css` | Tailwind CLI 監聽模式（HMR） |
| `npm run css:build` | 一次性壓縮 CSS |
| `npm test` | 執行全部整合測試 |
| `npm run openapi` | 從 JSDoc 生成 `swagger.json` |

---

## 文件索引

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 目錄結構、啟動流程、API 路由總覽、資料庫 Schema、認證機制 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、新增功能步驟、環境變數表 |
| [FEATURES.md](./FEATURES.md) | 功能清單、行為描述、錯誤碼說明 |
| [TESTING.md](./TESTING.md) | 測試架構、執行順序、撰寫新測試指南 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新日誌 |
| [plans/](./plans/) | 開發計畫目錄 |
| [plans/archive/](./plans/archive/) | 已完成計畫歸檔 |
