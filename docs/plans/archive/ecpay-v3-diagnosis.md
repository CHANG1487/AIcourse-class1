# ECPay AIO 金流串接 — 問題診斷 (v3)

## Context

**v2 修正已完成**（routes 語法正確、env vars 已設定、DB migration 已就位），但使用者點擊「前往付款」仍看到錯誤提示。

### 根因：伺服器從未重新啟動

**錯誤訊息變化**：

| 版本 | 前端 catch 行為 | 用戶看到的訊息 |
|------|---------------|--------------|
| v1 原始 | 固定字串 `'建立付款連結失敗'` | 「建立付款連結失敗」 |
| v2 修正後 | 顯示 API 真實錯誤 `e.data.message` | 「找不到該路徑」 |

**「找不到該路徑」的來源**：`app.js` 全域 404 handler，只在**請求完全沒有命中任何 router** 時觸發。

**原因**：Node.js 模組系統在 `require()` 時快取模組。ECPay 路由加入 `orderRoutes.js` 後，**伺服器未重啟**，記憶體中仍是無 ECPay 路由的舊版。前端 JS 在頁面重整後更新，但後端沒有。

結果：`POST /api/orders/:id/ecpay/create` → 全域 404 → "找不到該路徑"（v1 掩蓋，v2 顯示）。

### 次要問題：MerchantTradeNo 重複送單

同一訂單第二次點「前往付款」，ECPay 可能因 MerchantTradeNo 重複拒絕。修正：附加 4 碼秒數尾碼。

## 修改範圍

### `src/services/ecpayService.js`（修改）

```javascript
// 改為（16 + 4 suffix = 最多 20 chars，確保每次唯一）：
const baseMerchantTradeNo = order.order_no.replace(/-/g, '');
const suffix = String(Math.floor(Date.now() / 1000) % 9999).padStart(4, '0');
const merchantTradeNo = (baseMerchantTradeNo + suffix).slice(0, 20);
```

## 驗證步驟

1. **重啟伺服器**：`npm run dev:server`（核心修復）
2. 登入 → 加購物車 → 結帳 → **建立新訂單**
3. 訂單詳情頁點「前往付款（ECPay）」→ 應跳轉至 `payment-stage.ecpay.com.tw`
4. 信用卡測試：`4311-9522-2222-2222`，3D SMS `1234`
5. 付款完成 → 重導回訂單頁 → 狀態「付款成功！」
6. `npm test` → 32 tests 通過
