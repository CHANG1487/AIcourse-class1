# TESTING.md

## 測試架構

| 工具 | 用途 |
|------|------|
| Vitest 2.x | 測試框架（runner、assertion、globals） |
| supertest | HTTP 整合測試（對 Express app 發送真實請求） |

所有測試均為 **API 整合測試**，直接啟動 `app.js`（不啟動 HTTP server）並透過 supertest 發送請求，操作真實 SQLite 資料庫（`database.sqlite`）。沒有任何 mock。

---

## 測試檔案與說明

| 檔案 | 說明 |
|------|------|
| `tests/setup.js` | 共用輔助函式（`getAdminToken`、`registerUser`） |
| `tests/auth.test.js` | 認證 API 測試（register/login/profile） |
| `tests/products.test.js` | 商品 API 測試（列表/詳情/分頁/404） |
| `tests/cart.test.js` | 購物車 API 測試（訪客模式/登入模式/CRUD） |
| `tests/orders.test.js` | 訂單 API 測試（建立/查詢/404/無 auth） |
| `tests/adminProducts.test.js` | 後台商品 CRUD 測試（含權限驗證） |
| `tests/adminOrders.test.js` | 後台訂單測試（含狀態篩選、詳情含 user） |

---

## 執行順序與依賴關係

`vitest.config.js` 明確指定執行順序（`fileParallelism: false`）：

```
auth.test.js
  → products.test.js
    → cart.test.js
      → orders.test.js
        → adminProducts.test.js
          → adminOrders.test.js
```

**為何需要固定順序**：測試共用同一個 SQLite 資料庫檔案。`orders.test.js` 需要 `cart.test.js` 先執行以確保商品存在；`adminOrders.test.js` 的 `beforeAll` 需要建立一筆訂單，依賴商品資料。固定順序確保 seed 資料在所有測試執行前已存在。

**注意**：測試結束後資料庫會留有測試資料（用戶、訂單），重複執行測試不會清除舊資料，但 `registerUser()` 每次使用帶時間戳的隨機 email，因此不會衝突。

---

## 輔助函式（tests/setup.js）

```js
// 以 seed 管理員帳號登入，回傳 JWT token
async function getAdminToken(): Promise<string>

// 註冊一個新用戶，回傳 { token, user }
// overrides 可覆寫 email、password、name
async function registerUser(overrides = {}): Promise<{ token: string, user: object }>
```

`registerUser()` 預設 email 格式為 `test-<timestamp>-<random>@example.com`，確保每次執行都是唯一 email。

---

## 執行測試

```bash
# 執行全部測試
npm test

# 執行單一測試檔案（開發時快速確認）
npx vitest run tests/cart.test.js
```

---

## 撰寫新測試的步驟

1. 在 `tests/` 建立新的 `<name>.test.js` 檔案
2. 在 `vitest.config.js` 的 `sequence.files` 陣列中，將新檔案加到適當位置（注意相依順序）
3. 引入 `tests/setup.js` 的輔助函式：
   ```js
   const { app, request, getAdminToken, registerUser } = require('./setup');
   ```
4. 使用 `describe` + `it` 結構（Vitest 使用 globals，無需 import）
5. 若需要在測試前建立資料，使用 `beforeAll`（不要在 `it` 間建立跨測試的狀態，避免順序依賴）

### 範例：測試需要認證的端點

```js
const { app, request, registerUser } = require('./setup');

describe('新功能 API', () => {
  let userToken;

  beforeAll(async () => {
    const { token } = await registerUser();
    userToken = token;
  });

  it('should 回傳成功結果', async () => {
    const res = await request(app)
      .get('/api/some-endpoint')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
  });

  it('should 無 token 時回傳 401', async () => {
    const res = await request(app).get('/api/some-endpoint');
    expect(res.status).toBe(401);
    expect(res.body.error).not.toBeNull();
  });
});
```

---

## 驗證回應格式的最佳實踐

所有成功回應都必須驗證三個欄位：

```js
expect(res.body).toHaveProperty('data');       // data 存在
expect(res.body).toHaveProperty('error', null); // error 為 null
expect(res.body).toHaveProperty('message');    // message 存在
```

所有失敗回應：

```js
expect(res.body).toHaveProperty('data', null);  // data 為 null
expect(res.body).toHaveProperty('error');       // error 存在
expect(res.body.error).not.toBeNull();          // error 不為 null
```

---

## 常見陷阱

1. **不要並行執行測試檔案**：`fileParallelism: false` 是關鍵設定。若開啟並行，多個測試同時寫入同一個 SQLite 檔案會造成鎖定衝突（`SQLITE_BUSY`）。

2. **購物車測試使用 `X-Session-Id`**：訪客模式需要設定 `X-Session-Id` 標頭，而非 Authorization。測試中使用帶時間戳的 sessionId 確保隔離（`'test-session-' + Date.now()`）。

3. **訂單測試依賴購物車狀態**：`orders.test.js` 的 `beforeAll` 先加入購物車才建立訂單；成功建立訂單後購物車會被清空。後續測試「空購物車建立訂單」依賴此副作用，調整順序會導致測試失敗。

4. **admin 測試需要先取得 adminToken**：`getAdminToken()` 使用 seed 的 `admin@hexschool.com` 帳號，必須確保 DB 已初始化（import `app` 時自動執行 `initializeDatabase()`）。

5. **bcrypt 測試加速**：`NODE_ENV=test` 時 `saltRounds=1`（在 `src/database.js:83`），但測試指令（`npm test`）不會自動設定 `NODE_ENV`。若 seed 尚未建立管理員（首次執行），`bcrypt.hashSync` 會使用 saltRounds=10，略慢但正確。
