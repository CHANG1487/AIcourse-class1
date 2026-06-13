# ECPay AIO 金流串接 — 修正計畫 (v2)

## Context

第一版串接已完成（service 程式正確、DB schema 已加欄位、所有測試通過），但實際點擊「前往付款」時出現「建立付款連結失敗」。  
根因診斷：
1. `POST /:id/ecpay/create` 路由沒有 try-catch，任何執行時拋出的 exception 都被 Express `errorHandler` 轉成泛型 500，前端只收到 `{ message: '伺服器內部錯誤' }` 而看不到真正原因。
2. 前端 catch block 固定顯示 `'建立付款連結失敗'` 字串，遮蔽了 API 的實際錯誤訊息。
3. `ChoosePayment: 'Credit'` 限制只能信用卡；使用者希望開放綠界全部付款方式（`ChoosePayment: 'ALL'`），讓進入綠界付款頁後由使用者自選。
4. ATM/超商付款是非同步流程，回到訂單頁時 QueryTradeInfo 回 TradeStatus='0'（待付款），目前 UI 無對應提示，使用者不清楚下一步該怎麼做。

## 技術選擇（更新）

| 項目 | 選擇 | 理由 |
|------|------|------|
| 金流方案 | AIO（CMV-SHA256） | 同前，不變 |
| 付款方式 | `ChoosePayment=ALL` | 開放全部付款方式（信用卡、ATM、超商代碼/條碼），由使用者在綠界頁面選擇 |
| 狀態驗證 | QueryTradeInfo/V5 主動查詢 | 不依賴 ReturnURL S2S，本地可用 |
| 新增 npm 套件 | 無 | 不變 |

## 整體流程

```
1. 用戶在訂單詳情頁點擊「前往付款（ECPay）」
2. 前端 POST /api/orders/:id/ecpay/create
   ← 後端回傳 AIO form params JSON（含 CheckMacValue）
3. 前端動態建立 <form> 並 submit 至 ECPay 測試環境
   https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5
4. 使用者在綠界付款頁完成付款（測試卡：4311-9522-2222-2222）
5. 綠界 browser redirect 至 ClientBackURL：
   http://localhost:3001/orders/:id?payment_check=1
6. 頁面載入，偵測到 payment_check=1，自動呼叫：
   POST /api/orders/:id/ecpay/verify
7. 後端呼叫 QueryTradeInfo/V5，解析 URL-encoded 回應的 TradeStatus
8. 更新 orders.status（paid | failed），回傳結果
9. 前端顯示付款成功/失敗提示
```

## 本次修改範圍（修改 4 個檔案）

### 1. `src/services/ecpayService.js`

`buildAioFormParams` 函式中：
- `ChoosePayment: 'Credit'` → `ChoosePayment: 'ALL'`

### 2. `src/routes/orderRoutes.js`

`POST /:id/ecpay/create` 路由加上 try-catch，確保執行時錯誤可被記錄與回報。

### 3. `public/js/pages/order-detail.js`

- catch block 改顯示 API 實際錯誤訊息（而非固定字串）
- `paymentMessages` 新增 `pending` 狀態（ATM/超商取號後尚未繳費）
- `verifyPayment` 在 status 仍為 pending 時設 `paymentResult.value = 'pending'`

### 4. `views/pages/order-detail.ejs`

- 按鈕文字：`前往付款（信用卡）` → `前往付款（ECPay）`

## ATM / 超商付款流程說明

`ChoosePayment=ALL` 後，ATM/超商是非同步付款：
1. 使用者在綠界頁選擇 ATM/超商代碼 → 取得虛擬帳號/繳費代碼
2. 使用者點「返回商店」→ 瀏覽器回到 `ClientBackURL (?payment_check=1)`
3. 前端自動 verify → QueryTradeInfo → `TradeStatus='0'`（尚未付款）→ 顯示 pending 提示
4. 使用者繳費後手動刷新頁面 → 再次 verify → `TradeStatus='1'` → 狀態更新為 paid

## 端對端驗證步驟

1. `npm run dev:server` 重新啟動
2. 登入 → 加購物車 → 結帳 → 建立訂單
3. 進入訂單詳情頁，確認按鈕顯示「前往付款（ECPay）」
4. 點擊後確認跳轉至 `payment-stage.ecpay.com.tw`，頁面顯示多種付款方式
5. 信用卡測試：`4311-9522-2222-2222`，3D SMS 驗證碼 `1234`
6. 付款完成後確認重導回訂單頁，狀態顯示「付款成功！」
7. `npm test` → 32 tests 全部通過
