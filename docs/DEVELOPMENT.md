# DEVELOPMENT.md

## 開發環境設定

### 環境變數

複製 `.env.example` 為 `.env`：

```bash
cp .env.example .env
```

| 變數 | 說明 | 必要性 | 預設值 |
|------|------|--------|--------|
| `JWT_SECRET` | JWT 簽名金鑰（建議 32 字元以上隨機字串） | **必要** | 無（缺少則拒絕啟動） |
| `BASE_URL` | 伺服器對外 URL（OpenAPI spec 使用） | 選填 | `http://localhost:3001` |
| `FRONTEND_URL` | CORS 允許來源 | 選填 | `http://localhost:3001` |
| `ADMIN_EMAIL` | seed 管理員帳號 | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | seed 管理員密碼 | 選填 | `12345678` |
| `PORT` | 監聽埠（`server.js` 讀取） | 選填 | `3001` |
| `ECPAY_MERCHANT_ID` | 綠界商店 ID | 選填 | `3002607`（測試用） |
| `ECPAY_HASH_KEY` | 綠界 HashKey | 選填 | （測試金鑰） |
| `ECPAY_HASH_IV` | 綠界 HashIV | 選填 | （測試金鑰） |
| `ECPAY_ENV` | 環境（`staging` \| `production`） | 選填 | `staging` |
| `NODE_ENV` | 執行環境（`test` 時 bcrypt saltRounds 降為 1） | 選填 | 未設定 |

---

## 模組系統

本專案使用 **CommonJS**（`require`/`module.exports`），**不使用** ESM（`import`/`export`）。

唯一例外：`vitest.config.js` 使用 ESM 語法（`export default defineConfig(...)`），因為 Vitest 的設定檔預設以 ESM 解析。

---

## 命名規則

### 檔案命名

| 類型 | 規則 | 範例 |
|------|------|------|
| 路由檔案 | camelCase + `Routes` 後綴 | `cartRoutes.js`, `adminOrderRoutes.js` |
| Middleware | camelCase + `Middleware` 後綴 | `authMiddleware.js`, `sessionMiddleware.js` |
| 資料庫 | 單數名詞 | `database.js` |
| 測試檔案 | camelCase + `.test.js` 後綴 | `cart.test.js`, `adminOrders.test.js` |
| 前端頁面 JS | kebab-case | `order-detail.js`, `admin-products.js` |
| EJS 模板 | kebab-case | `product-detail.ejs`, `admin-header.ejs` |

### 資料庫欄位

資料庫欄位一律使用 **snake_case**（`user_id`、`created_at`、`product_name`）。

### API 請求 Body

請求 body 欄位使用 **camelCase**（`productId`、`recipientName`、`recipientEmail`）。

### API 回應 Body

回應 body 中的 data 物件欄位使用 **snake_case**（與資料庫欄位一致），例如 `order_no`、`total_amount`、`created_at`。

---

## 新增 API 端點的步驟

1. **在對應的路由檔案新增路由**（`src/routes/`）
   - 使用 Express router method（`router.get`, `router.post` 等）
   - 加上 JSDoc `@openapi` 注釋（格式見下方 JSDoc 說明）
   - 遵循統一回應格式 `{ data, error, message }`

2. **若需要新的 middleware，建立於 `src/middleware/`**
   - Export 單一函式 `function xxxMiddleware(req, res, next) {...}`

3. **在 `app.js` 掛載新路由**（若是全新的路由檔案）
   ```js
   app.use('/api/新路由前綴', require('./src/routes/新路由'));
   ```

4. **為新端點撰寫測試**（見 [TESTING.md](./TESTING.md)）

5. **重新生成 OpenAPI 文件**
   ```bash
   npm run openapi
   ```

---

## 新增 Middleware 的步驟

1. 在 `src/middleware/` 建立新檔案
2. 函式必須處理 `(req, res, next)` 三個參數
3. 成功時呼叫 `next()`，失敗時呼叫 `res.status(...).json(...)` 並不呼叫 `next`
4. 在路由使用：`router.use(newMiddleware)` 或 `router.get('/path', newMiddleware, handler)`

---

## 新增資料庫表格的步驟

1. 在 `src/database.js` 的 `db.exec(...)` 區塊加入 `CREATE TABLE IF NOT EXISTS`
2. 若需要 seed 資料，建立獨立函式（參考 `seedAdminUser()`、`seedProducts()`）
3. 在 `initializeDatabase()` 中呼叫新的 seed 函式
4. **注意**：better-sqlite3 使用同步 API，不需要 async/await

---

## JSDoc 格式說明

所有 API 端點必須加上 OpenAPI 注釋，`generate-openapi.js` 會掃描 `src/routes/**/*.js` 並輸出 `swagger.json`：

```js
/**
 * @openapi
 * /api/some/path:
 *   post:
 *     summary: 端點摘要（中文可）
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fieldA, fieldB]
 *             properties:
 *               fieldA:
 *                 type: string
 *               fieldB:
 *                 type: integer
 *     responses:
 *       201:
 *         description: 成功描述
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       400:
 *         description: 失敗描述
 */
router.post('/some/path', handler);
```

`swagger-config.js` 定義了以下 securitySchemes，路由直接引用：
- `bearerAuth`：JWT Bearer Token
- `sessionId`：X-Session-Id 標頭（訪客購物車）

---

## 計畫歸檔流程

1. **計畫檔案命名格式**：`YYYY-MM-DD-<feature-name>.md`（例如 `2026-06-13-payment-integration.md`）
2. **計畫文件結構**：
   ```markdown
   # [功能名稱] 開發計畫

   ## User Story
   作為 <角色>，我希望 <功能>，以便 <價值>。

   ## Spec
   - 詳細規格說明
   - API 設計
   - 資料庫異動

   ## Tasks
   - [ ] Task 1
   - [ ] Task 2
   - [x] 已完成 Task
   ```
3. **功能完成後**：將計畫檔案移至 `docs/plans/archive/`
4. **同步更新**：`docs/FEATURES.md`（標記功能為完成）和 `docs/CHANGELOG.md`（記錄版本更新）

---

## 注意事項

- **不要在路由 handler 裡直接 `throw`**，Express 4.x 的同步路由不會自動捕捉 throw，應使用 `res.status().json()` 回傳錯誤，或呼叫 `next(err)` 交給 `errorHandler`。
- **better-sqlite3 的 `db.prepare().run()` 是同步的**，不需要也不應使用 `async/await`。
- **bcrypt** 在測試環境（`NODE_ENV=test`）使用 `saltRounds=1` 加速，生產環境使用 `10`（見 `database.js:83`）。
- **訂單編號生成**（`generateOrderNo()`）：`ORD-YYYYMMDD-XXXXX`，XXXXX 取 UUID v4 前 5 碼大寫。格式範例：`ORD-20260613-A1B2C`。
