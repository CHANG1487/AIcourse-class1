# ARCHITECTURE.md

## 目錄結構

```
.
├── server.js                  # 進入點：讀取 PORT、驗證 JWT_SECRET、啟動 HTTP server
├── app.js                     # Express 應用設定（middleware、路由掛載、404/錯誤處理）
├── vitest.config.js           # 測試執行設定（固定順序、關閉並行）
├── generate-openapi.js        # 從 JSDoc 生成 swagger.json 的腳本
├── swagger-config.js          # OpenAPI 基礎設定（title、servers、securitySchemes）
├── database.sqlite            # SQLite 資料庫檔案（WAL 模式）
├── .env.example               # 環境變數範本
│
├── src/
│   ├── database.js            # DB 連線、建表（CREATE TABLE IF NOT EXISTS）、seed 資料
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT Bearer Token 驗證，解碼後掛 req.user
│   │   ├── adminMiddleware.js # 角色檢查（req.user.role === 'admin'），必須在 authMiddleware 之後
│   │   ├── sessionMiddleware.js # 讀取 X-Session-Id 標頭，掛 req.sessionId（供購物車訪客模式使用）
│   │   └── errorHandler.js   # Express 全域錯誤處理（最終 fallback，回傳統一 JSON）
│   └── routes/
│       ├── authRoutes.js      # POST /register, POST /login, GET /profile
│       ├── productRoutes.js   # GET /products, GET /products/:id（公開）
│       ├── cartRoutes.js      # GET/POST /cart, PATCH/DELETE /cart/:itemId（雙模式認證）
│       ├── orderRoutes.js     # POST/GET /orders, GET /orders/:id, PATCH /orders/:id/pay（JWT only）
│       ├── adminProductRoutes.js # GET/POST /admin/products, PUT/DELETE /admin/products/:id（admin only）
│       ├── adminOrderRoutes.js   # GET /admin/orders, GET /admin/orders/:id（admin only）
│       └── pageRoutes.js      # EJS 頁面路由（前台 + 後台）
│
├── views/
│   ├── layouts/
│   │   ├── front.ejs          # 前台共用版型（含 head、header、footer）
│   │   └── admin.ejs          # 後台共用版型（含 admin-header、admin-sidebar）
│   ├── pages/
│   │   ├── index.ejs          # 前台首頁（商品列表）
│   │   ├── product-detail.ejs # 商品詳情頁
│   │   ├── cart.ejs           # 購物車頁
│   │   ├── checkout.ejs       # 結帳頁
│   │   ├── login.ejs          # 登入頁（含註冊）
│   │   ├── orders.ejs         # 我的訂單列表
│   │   ├── order-detail.ejs   # 訂單詳情（含模擬付款）
│   │   ├── 404.ejs            # 404 頁面
│   │   └── admin/
│   │       ├── products.ejs   # 後台商品管理
│   │       └── orders.ejs     # 後台訂單管理
│   └── partials/
│       ├── head.ejs           # <head> 標籤（CSS、title）
│       ├── header.ejs         # 前台導覽列
│       ├── footer.ejs         # 前台頁尾
│       ├── admin-header.ejs   # 後台頂部列
│       ├── admin-sidebar.ejs  # 後台側邊欄
│       └── notification.ejs  # 通知訊息元件（全域 toast）
│
├── public/
│   ├── css/
│   │   ├── input.css          # Tailwind 來源（@import "tailwindcss"）
│   │   └── output.css         # Tailwind 編譯輸出（git tracked，但由 CLI 生成）
│   ├── stylesheets/
│   │   └── style.css          # 自訂全域 CSS（非 Tailwind）
│   └── js/
│       ├── api.js             # 前端 API 呼叫工具（fetch wrapper、統一錯誤處理）
│       ├── auth.js            # localStorage token 讀寫、登入狀態判斷
│       ├── header-init.js     # 頁面載入後初始化 header 狀態（登入/登出按鈕）
│       ├── notification.js    # Toast 通知顯示邏輯
│       └── pages/             # 各頁面專屬 JS（index/product-detail/cart/checkout/login/orders/order-detail/admin-products/admin-orders）
│
└── tests/
    ├── setup.js               # 共用輔助函式（getAdminToken、registerUser）
    ├── auth.test.js
    ├── products.test.js
    ├── cart.test.js
    ├── orders.test.js
    ├── adminProducts.test.js
    └── adminOrders.test.js
```

---

## 啟動流程

```
npm start
  └─ css:build（Tailwind CLI 壓縮編譯）
       └─ node server.js
            ├─ require('dotenv').config()          ← 讀取 .env
            ├─ require('./app')                    ← 建立 Express 應用
            │    ├─ require('./src/database')      ← 連接 SQLite，建表，seed 資料
            │    ├─ 掛載全域 middleware
            │    │    ├─ cors（允許 FRONTEND_URL）
            │    │    ├─ express.json()
            │    │    ├─ express.urlencoded()
            │    │    └─ sessionMiddleware（讀取 X-Session-Id）
            │    ├─ 掛載 API 路由
            │    └─ 掛載 Page 路由 + 404 + errorHandler
            └─ 驗證 JWT_SECRET 存在 → app.listen(PORT)
```

資料庫連線在 `require('./src/database')` 時同步建立，`initializeDatabase()` 依序執行：
1. `CREATE TABLE IF NOT EXISTS` 建立五張表
2. `seedAdminUser()` — 若管理員 email 不存在才 INSERT
3. `seedProducts()` — 若 products 表為空才批次 INSERT 8 筆範例商品（使用 transaction）

---

## API 路由總覽

### 公開路由（無需認證）

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/register` | 註冊新帳號 |
| POST | `/api/auth/login` | 登入取得 JWT |
| GET | `/api/products` | 商品列表（分頁） |
| GET | `/api/products/:id` | 商品詳情 |

### 雙模式認證路由（JWT Bearer Token 或 X-Session-Id 標頭）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/cart` | 查看購物車 |
| POST | `/api/cart` | 加入商品 |
| PATCH | `/api/cart/:itemId` | 修改數量 |
| DELETE | `/api/cart/:itemId` | 移除項目 |

### 需要 JWT（一般使用者）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/auth/profile` | 取得個人資料 |
| POST | `/api/orders` | 從購物車建立訂單 |
| GET | `/api/orders` | 我的訂單列表 |
| GET | `/api/orders/:id` | 訂單詳情 |
| PATCH | `/api/orders/:id/pay` | 模擬付款（success/fail） |

### 需要 JWT + Admin 角色

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/admin/products` | 後台商品列表（分頁） |
| POST | `/api/admin/products` | 新增商品 |
| PUT | `/api/admin/products/:id` | 編輯商品 |
| DELETE | `/api/admin/products/:id` | 刪除商品（pending 訂單保護） |
| GET | `/api/admin/orders` | 後台訂單列表（分頁、狀態篩選） |
| GET | `/api/admin/orders/:id` | 後台訂單詳情（含 user 資訊） |

### 頁面路由（EJS SSR）

| 方法 | 路徑 | 頁面 |
|------|------|------|
| GET | `/` | 前台首頁 |
| GET | `/products/:id` | 商品詳情 |
| GET | `/cart` | 購物車 |
| GET | `/checkout` | 結帳 |
| GET | `/login` | 登入／註冊 |
| GET | `/orders` | 我的訂單 |
| GET | `/orders/:id` | 訂單詳情（query: `?payment=`) |
| GET | `/admin/products` | 後台商品管理 |
| GET | `/admin/orders` | 後台訂單管理 |

---

## 統一回應格式

所有 API 端點（包含錯誤）一律回傳以下結構：

```json
{
  "data": { ... } | null,
  "error": null | "ERROR_CODE",
  "message": "人類可讀訊息"
}
```

成功範例：
```json
{
  "data": { "id": "abc-123", "email": "user@example.com" },
  "error": null,
  "message": "登入成功"
}
```

失敗範例：
```json
{
  "data": null,
  "error": "VALIDATION_ERROR",
  "message": "email、password、name 為必填欄位"
}
```

常見 error 代碼：

| 代碼 | 說明 |
|------|------|
| `VALIDATION_ERROR` | 請求參數格式錯誤或缺少必填欄位 |
| `UNAUTHORIZED` | 未提供 Token 或 Token 無效/過期 |
| `FORBIDDEN` | 已登入但角色不足（非 admin） |
| `NOT_FOUND` | 找不到指定資源 |
| `CONFLICT` | 資源衝突（例如 email 重複、pending 訂單保護） |
| `CART_EMPTY` | 購物車為空，無法建立訂單 |
| `STOCK_INSUFFICIENT` | 庫存不足 |
| `INVALID_STATUS` | 訂單狀態不允許此操作 |
| `INTERNAL_ERROR` | 伺服器內部錯誤 |

---

## 認證與授權機制

### JWT

- **演算法**：HS256
- **有效期**：7 天（`expiresIn: '7d'`）
- **Payload**：`{ userId, email, role }`
- **使用方式**：`Authorization: Bearer <token>` 標頭
- **驗證流程**（`authMiddleware.js`）：
  1. 確認 Authorization 標頭存在且以 `Bearer ` 開頭
  2. 使用 `jwt.verify()` 搭配 `JWT_SECRET` 解碼，指定演算法為 HS256
  3. 查詢資料庫確認 `decoded.userId` 對應的用戶仍存在（防止已刪除帳號的舊 Token）
  4. 將 `{ userId, email, role }` 掛至 `req.user`

### Admin 角色驗證

`adminMiddleware.js` 必須串接在 `authMiddleware` 之後使用（`router.use(authMiddleware, adminMiddleware)`），它只檢查 `req.user.role === 'admin'`。

### 購物車雙模式認證（dualAuth）

`cartRoutes.js` 中的 `dualAuth` 函式實作兩種模式：

1. **JWT 模式**：若 `Authorization: Bearer <token>` 標頭存在且有效，使用 `user_id` 欄位識別購物車
2. **Session 模式**：若無 Authorization 標頭但有 `X-Session-Id` 標頭，使用 `session_id` 欄位識別購物車
3. **錯誤情境**：若 Authorization 標頭存在但 Token 無效，直接回 401（不會 fallback 到 session），避免安全漏洞

`getOwnerCondition(req)` 根據上述判斷，回傳 `{ field: 'user_id' | 'session_id', value }` 供 SQL 查詢動態使用。

---

## 資料庫 Schema

資料庫使用 SQLite，WAL 模式開啟（`PRAGMA journal_mode = WAL`），外鍵約束開啟（`PRAGMA foreign_keys = ON`）。

### users

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| email | TEXT | UNIQUE NOT NULL | 用戶 email |
| password_hash | TEXT | NOT NULL | bcrypt hash（saltRounds=10；測試環境為 1） |
| name | TEXT | NOT NULL | 顯示名稱 |
| role | TEXT | NOT NULL, DEFAULT 'user', CHECK IN ('user','admin') | 角色 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間（ISO 8601） |

### products

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | 商品名稱 |
| description | TEXT | — | 商品描述（可為 NULL） |
| price | INTEGER | NOT NULL, CHECK(price > 0) | 單價（新台幣，整數） |
| stock | INTEGER | NOT NULL, DEFAULT 0, CHECK(stock >= 0) | 庫存數量 |
| image_url | TEXT | — | 商品圖片 URL（可為 NULL） |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL, DEFAULT datetime('now') | 最後更新時間（PUT 時手動更新） |

### cart_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| session_id | TEXT | — | 訪客 session ID（與 user_id 擇一使用） |
| user_id | TEXT | FK → users(id) | 已登入用戶 ID（與 session_id 擇一使用） |
| product_id | TEXT | NOT NULL, FK → products(id) | 商品 ID |
| quantity | INTEGER | NOT NULL, DEFAULT 1, CHECK(quantity > 0) | 數量 |

**注意**：同一 `product_id + user_id`（或 `+ session_id`）組合在購物車中只會有一筆記錄，加入相同商品時累加 quantity。

### orders

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_no | TEXT | UNIQUE NOT NULL | 訂單編號，格式 `ORD-YYYYMMDD-XXXXX` |
| user_id | TEXT | NOT NULL, FK → users(id) | 下單用戶 |
| recipient_name | TEXT | NOT NULL | 收件人姓名 |
| recipient_email | TEXT | NOT NULL | 收件人 email |
| recipient_address | TEXT | NOT NULL | 收件地址 |
| total_amount | INTEGER | NOT NULL | 訂單總金額（整數，新台幣） |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','paid','failed') | 付款狀態 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |

### order_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_id | TEXT | NOT NULL, FK → orders(id) | 所屬訂單 |
| product_id | TEXT | NOT NULL | 商品 ID（快照，不設 FK 以允許商品刪除） |
| product_name | TEXT | NOT NULL | 下單當下的商品名稱（快照） |
| product_price | INTEGER | NOT NULL | 下單當下的商品單價（快照） |
| quantity | INTEGER | NOT NULL | 購買數量 |

**重要**：`order_items` 的 `product_name` 和 `product_price` 是下單時的快照，不會隨商品編輯而變動。`product_id` 不設外鍵，因此商品被刪除後歷史訂單明細仍保留完整。

---

## 資料流：建立訂單

```
POST /api/orders
  ↓
authMiddleware（驗證 JWT）
  ↓
驗證 recipientName / recipientEmail / recipientAddress
  ↓
查詢 cart_items WHERE user_id = ?（JOIN products）
  ↓
購物車是否為空？→ 400 CART_EMPTY
  ↓
逐一比對 quantity > product.stock？→ 400 STOCK_INSUFFICIENT
  ↓
計算 totalAmount = Σ(price × quantity)
  ↓
SQLite Transaction（原子性）：
  ├─ INSERT INTO orders（生成 order_no：ORD-YYYYMMDD-XXXXX）
  ├─ 逐筆 INSERT INTO order_items（快照商品名稱與價格）
  ├─ 逐筆 UPDATE products SET stock = stock - quantity
  └─ DELETE FROM cart_items WHERE user_id = ?
  ↓
回傳 201 含訂單資訊與 items 列表
```

---

## 頁面渲染架構（EJS SSR）

`pageRoutes.js` 的 `renderFront()` 和 `renderAdmin()` 使用兩段式渲染：

1. 先 render 頁面片段（`views/pages/<page>.ejs`），得到 `body` HTML 字串
2. 再 render layout（`views/layouts/front.ejs` 或 `admin.ejs`），將 `body` 嵌入

前台 EJS 頁面本身只包含頁面內容，JS 行為全部在 `public/js/pages/<pageScript>.js` 透過 API 呼叫完成（SPA-like）。後台同理。
