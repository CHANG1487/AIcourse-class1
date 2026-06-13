# FEATURES.md

功能完成狀態與詳細行為描述。

## 功能清單

| 功能 | 狀態 |
|------|------|
| 用戶認證（註冊／登入／個人資料） | ✅ 完成 |
| 商品列表與詳情（公開） | ✅ 完成 |
| 購物車（訪客 + 已登入雙模式） | ✅ 完成 |
| 訂單建立（含 Transaction 庫存扣除） | ✅ 完成 |
| 訂單查詢（個人） | ✅ 完成 |
| 模擬付款（success/fail） | ✅ 完成 |
| 後台商品管理（CRUD） | ✅ 完成 |
| 後台訂單查詢（分頁 + 狀態篩選） | ✅ 完成 |
| EJS 前台頁面（SSR） | ✅ 完成 |
| EJS 後台頁面（SSR） | ✅ 完成 |
| OpenAPI / Swagger 文件生成 | ✅ 完成 |
| 整合測試（Vitest + supertest） | ✅ 完成 |

---

## 用戶認證

### 行為描述

**POST /api/auth/register** — 註冊新帳號

- 必填欄位：`email`（字串）、`password`（字串）、`name`（字串）
- email 格式驗證：正規表達式 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- password 最短長度：6 個字元
- 若 email 已存在於 `users` 表，回 409 `CONFLICT`
- 成功後以 bcrypt（saltRounds=10）雜湊密碼，使用 UUID v4 作為 id，寫入 `users` 表，`role` 固定為 `'user'`（非管理員）
- 回 201，回應 body 包含 `data.user`（id/email/name/role）與 `data.token`（7 天 JWT）

**POST /api/auth/login** — 登入

- 必填欄位：`email`、`password`
- 若 email 不存在，或密碼 bcrypt 比對失敗，統一回 401 `UNAUTHORIZED`（刻意不區分「email 不存在」與「密碼錯誤」，避免帳號列舉攻擊）
- 成功回 200，回應 body 同 register（含 token 與 user）

**GET /api/auth/profile** — 取得個人資料（需 JWT）

- 從 JWT payload 的 `userId` 查詢 `users` 表，回傳 `id/email/name/role/created_at`
- 不回傳 `password_hash`

### 錯誤碼

| 情境 | HTTP | error |
|------|------|-------|
| 缺少必填欄位 | 400 | `VALIDATION_ERROR` |
| email 格式錯誤 | 400 | `VALIDATION_ERROR` |
| 密碼少於 6 字元 | 400 | `VALIDATION_ERROR` |
| email 已被註冊 | 409 | `CONFLICT` |
| email/密碼錯誤 | 401 | `UNAUTHORIZED` |
| 無 Token 或 Token 無效 | 401 | `UNAUTHORIZED` |

---

## 商品

### 行為描述

**GET /api/products** — 商品列表

- 查詢參數：`page`（預設 1）、`limit`（預設 10，上限 100，下限 1）
- 回傳 `data.products`（陣列）與 `data.pagination`（`{ total, page, limit, totalPages }`）
- 依 `created_at DESC` 排序（最新的在前）
- 無需認證，任何人可訪問

**GET /api/products/:id** — 商品詳情

- 依 id 查詢，不存在回 404 `NOT_FOUND`
- 回傳完整商品欄位（含 `stock`、`image_url`、`created_at`、`updated_at`）

### 錯誤碼

| 情境 | HTTP | error |
|------|------|-------|
| 商品不存在 | 404 | `NOT_FOUND` |

---

## 購物車（雙模式認證）

### 行為描述

購物車同時支援已登入用戶（JWT）與訪客（X-Session-Id）兩種操作模式：

- **JWT 模式**：`Authorization: Bearer <token>` 標頭，購物車項目以 `user_id` 綁定
- **Session 模式**：`X-Session-Id: <任意字串>` 標頭，購物車項目以 `session_id` 綁定

兩種模式在 `cart_items` 表中存放的欄位不同（`user_id` vs `session_id`），因此訪客加入的購物車在登入後**不會**自動合併。

**重要邊界情況**：若 `Authorization` 標頭存在但 Token 無效，直接回 401，不會 fallback 至 session 模式。

**GET /api/cart** — 查看購物車

- 依認證模式查詢 `cart_items JOIN products`
- 回傳 `data.items`（陣列，每項含 `product` 子物件）與 `data.total`（總金額）

**POST /api/cart** — 加入商品

- 必填：`productId`（字串）
- 選填：`quantity`（正整數，預設 1）
- 若商品已在購物車中，**累加** quantity（不是取代）
- 加入後檢查累積 quantity 是否超過 `product.stock`，超過回 400 `STOCK_INSUFFICIENT`
- 若商品不存在回 404 `NOT_FOUND`

**PATCH /api/cart/:itemId** — 修改數量

- 必填：`quantity`（正整數）
- 確認 itemId 屬於當前用戶/session，否則回 404
- 確認新 quantity 不超過 `product.stock`，否則回 400 `STOCK_INSUFFICIENT`
- 直接設定（非累加）

**DELETE /api/cart/:itemId** — 移除項目

- 確認 itemId 屬於當前用戶/session，否則回 404
- 刪除後購物車中無此商品

### 錯誤碼

| 情境 | HTTP | error |
|------|------|-------|
| 無 Token 且無 Session ID | 401 | `UNAUTHORIZED` |
| Token 存在但無效 | 401 | `UNAUTHORIZED` |
| 商品不存在 | 404 | `NOT_FOUND` |
| 購物車項目不存在（或不屬於此用戶） | 404 | `NOT_FOUND` |
| 庫存不足 | 400 | `STOCK_INSUFFICIENT` |
| quantity 非正整數 | 400 | `VALIDATION_ERROR` |

---

## 訂單

### 行為描述

**POST /api/orders** — 建立訂單（需 JWT）

- 必填：`recipientName`、`recipientEmail`（格式驗證）、`recipientAddress`
- 僅讀取 `user_id` 綁定的購物車項目（不支援 session 模式），因此必須先登入再加入購物車
- 建立流程（原子 Transaction）：
  1. 驗證購物車非空（否則 400 `CART_EMPTY`）
  2. 批次比對所有購物車商品的 quantity 與 stock（否則 400 `STOCK_INSUFFICIENT`，列出所有不足商品名稱）
  3. 計算總金額
  4. INSERT `orders`（生成 `order_no`：`ORD-YYYYMMDD-XXXXX`）
  5. 批次 INSERT `order_items`（快照 `product_name` 與 `product_price`）
  6. 批次 UPDATE `products.stock`（`stock = stock - quantity`）
  7. DELETE 用戶的所有 `cart_items`
- 若 transaction 失敗（資料庫錯誤），所有步驟回滾
- 回 201，回傳訂單資訊與 items 列表

**GET /api/orders** — 我的訂單列表（需 JWT）

- 只回傳當前用戶的訂單（`WHERE user_id = ?`）
- 依 `created_at DESC` 排序
- 回傳欄位：`id, order_no, total_amount, status, created_at`

**GET /api/orders/:id** — 訂單詳情（需 JWT）

- 必須是當前用戶的訂單（`WHERE id = ? AND user_id = ?`）
- 回傳完整訂單欄位，含 `items` 陣列（order_items 的所有欄位）

**PATCH /api/orders/:id/pay** — 模擬付款（需 JWT）

- 必填：`action`（`'success'` 或 `'fail'`）
- 訂單必須是當前用戶的，且 status 必須為 `'pending'`
- `action=success` → status 改為 `'paid'`
- `action=fail` → status 改為 `'failed'`
- 狀態一旦變更，無法再次觸發（400 `INVALID_STATUS`）

### 錯誤碼

| 情境 | HTTP | error |
|------|------|-------|
| 缺少必填欄位 | 400 | `VALIDATION_ERROR` |
| recipientEmail 格式錯誤 | 400 | `VALIDATION_ERROR` |
| 購物車為空 | 400 | `CART_EMPTY` |
| 有商品庫存不足 | 400 | `STOCK_INSUFFICIENT` |
| 訂單不存在或不屬於此用戶 | 404 | `NOT_FOUND` |
| action 無效 | 400 | `VALIDATION_ERROR` |
| 訂單狀態不是 pending | 400 | `INVALID_STATUS` |
| 無 JWT | 401 | `UNAUTHORIZED` |

---

## 後台商品管理（Admin）

### 行為描述

所有後台路由需 JWT + admin 角色（`authMiddleware + adminMiddleware`）。

**GET /api/admin/products** — 商品列表

- 與前台 `GET /api/products` 邏輯相同（分頁、排序），差異僅在需要 admin 認證
- 查詢參數：`page`（預設 1）、`limit`（預設 10，上限 100）

**POST /api/admin/products** — 新增商品

- 必填：`name`（字串）、`price`（正整數）、`stock`（非負整數）
- 選填：`description`（字串）、`image_url`（字串）
- 驗證：name 不能為空，price 必須 > 0，stock 必須 >= 0
- 回 201，回傳完整商品物件

**PUT /api/admin/products/:id** — 編輯商品

- 全欄位選填更新（PATCH 語義但用 PUT 路由）：未提供的欄位保留原值
- 驗證規則與新增相同（若提供則驗證，未提供則跳過）
- 同時更新 `updated_at = datetime('now')`

**DELETE /api/admin/products/:id** — 刪除商品

- 刪除前檢查：若商品存在於 status 為 `'pending'` 的訂單 items 中，回 409 `CONFLICT` 拒絕刪除
- 已 `paid` 或 `failed` 的訂單中的商品可以刪除（`order_items` 有快照，不影響歷史記錄）
- 刪除後商品從 `products` 表移除，但 `order_items` 中的快照資料仍保留

### 錯誤碼

| 情境 | HTTP | error |
|------|------|-------|
| 未登入 | 401 | `UNAUTHORIZED` |
| 非 admin 角色 | 403 | `FORBIDDEN` |
| 商品不存在 | 404 | `NOT_FOUND` |
| 缺少必填或格式錯誤 | 400 | `VALIDATION_ERROR` |
| 存在 pending 訂單 | 409 | `CONFLICT` |

---

## 後台訂單查詢（Admin）

### 行為描述

**GET /api/admin/orders** — 訂單列表

- 查詢參數：`page`（預設 1）、`limit`（預設 10，上限 100）、`status`（選填，`pending`/`paid`/`failed`）
- 若 `status` 不在允許值內，忽略此篩選條件（不報錯）
- 回傳所有用戶的訂單（後台無 `user_id` 限制）
- 依 `created_at DESC` 排序
- 回傳欄位含完整訂單資訊（含 `recipient_name`、`recipient_email`）

**GET /api/admin/orders/:id** — 訂單詳情

- 可查詢任何用戶的訂單（無 `user_id` 限制）
- 回傳訂單完整欄位 + `items` 陣列 + `user` 物件（`{ name, email }`，若用戶已刪除則為 `null`）

### 錯誤碼

| 情境 | HTTP | error |
|------|------|-------|
| 未登入 | 401 | `UNAUTHORIZED` |
| 非 admin 角色 | 403 | `FORBIDDEN` |
| 訂單不存在 | 404 | `NOT_FOUND` |

---

## 前台頁面

所有前台頁面均以 EJS SSR 輸出初始 HTML，互動邏輯由各頁面的 `public/js/pages/<name>.js` 透過 API 完成：

| 路徑 | 頁面 JS | 說明 |
|------|---------|------|
| `/` | `index.js` | 商品列表，呼叫 `GET /api/products` |
| `/products/:id` | `product-detail.js` | 商品詳情與加入購物車 |
| `/cart` | `cart.js` | 購物車管理（含訪客模式 session ID） |
| `/checkout` | `checkout.js` | 填寫收件資訊並建立訂單 |
| `/login` | `login.js` | 登入與註冊表單 |
| `/orders` | `orders.js` | 我的訂單列表 |
| `/orders/:id` | `order-detail.js` | 訂單詳情與模擬付款 |

## 後台頁面

| 路徑 | 頁面 JS | 說明 |
|------|---------|------|
| `/admin/products` | `admin-products.js` | 商品 CRUD 管理介面 |
| `/admin/orders` | `admin-orders.js` | 訂單列表（支援狀態篩選） |
