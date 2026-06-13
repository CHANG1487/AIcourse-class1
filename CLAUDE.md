# CLAUDE.md

## 專案概述
Flower Shop Backend — Node.js / Express + SQLite（better-sqlite3）+ EJS 伺服器端渲染的花卉電商平台，提供前台購物流程與後台管理 API，並以 Vitest + supertest 進行 API 整合測試。

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm start` | 建置 CSS 後啟動伺服器（生產模式） |
| `npm run dev:server` | 直接啟動伺服器（不重新建置 CSS） |
| `npm run dev:css` | 監聽 Tailwind CSS 異動並即時重新編譯 |
| `npm run css:build` | 一次性壓縮建置 CSS |
| `npm test` | 執行所有整合測試（按固定順序） |
| `npm run openapi` | 從 JSDoc 生成 OpenAPI spec（輸出至 swagger.json） |

## 關鍵規則

1. **JWT_SECRET 是必要環境變數**：`server.js` 在啟動時會驗證是否存在，缺少則直接 `process.exit(1)`。複製 `.env.example` 為 `.env` 並填入實際值才能啟動。
2. **購物車雙模式認證（dualAuth）**：`/api/cart` 的所有端點同時接受 JWT Bearer Token（已登入用戶）或 `X-Session-Id` 標頭（訪客），二者擇一即可；兩者都沒有則回 401。其餘 `/api/orders`、`/api/admin/*` 只接受 JWT。
3. **統一回應格式**：所有 API 必須回傳 `{ data, error, message }` 三個欄位。成功時 `error: null`，失敗時 `data: null`。
4. **訂單建立使用 SQLite Transaction**：建立訂單會在同一 transaction 內寫入 `orders`、`order_items`，扣除 `products.stock`，並清空 `cart_items`——這四個步驟是原子性的，不能拆散。
5. **刪除商品的保護機制**：`DELETE /api/admin/products/:id` 會先確認商品是否存在於 status 為 `pending` 的訂單中，若有則回 409 拒絕刪除，防止資料不一致。
6. **功能開發使用 docs/plans/ 記錄計畫；完成後移至 docs/plans/archive/**。

## 詳細文件

- [./docs/README.md](./docs/README.md) — 項目介紹與快速開始
- [./docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、資料流
- [./docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則
- [./docs/FEATURES.md](./docs/FEATURES.md) — 功能列表與完成狀態
- [./docs/TESTING.md](./docs/TESTING.md) — 測試規範與指南
- [./docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌
