# CHANGELOG.md

版本歷史依時間倒序排列。

---

## [1.0.0] - 2026-06-13

### 初始版本

**認證系統**
- 用戶註冊（email/password/name，bcrypt 密碼雜湊）
- 用戶登入（JWT，7 天有效期，HS256 演算法）
- 取得個人資料（需 JWT）

**商品**
- 公開商品列表（分頁：page/limit，預設 10 筆，上限 100）
- 公開商品詳情
- 8 筆花卉商品 seed 資料（玫瑰、百合、向日葵、鬱金香、乾燥花圈、多肉植物、紅玫瑰、訂閱服務）

**購物車**
- 雙模式認證：JWT Bearer Token（已登入）或 X-Session-Id 標頭（訪客）
- 加入商品（重複加入則累加數量）
- 查看購物車（含商品資訊與總金額）
- 修改數量（直接設定，需驗證庫存）
- 移除項目

**訂單**
- 從購物車建立訂單（SQLite Transaction：寫入訂單、快照商品資訊、扣除庫存、清空購物車）
- 訂單編號格式：`ORD-YYYYMMDD-XXXXX`
- 查詢我的訂單列表
- 查詢訂單詳情
- 模擬付款（action: success → paid，fail → failed；只有 pending 狀態可觸發）

**後台管理**
- 商品管理：新增、查詢（分頁）、編輯（全欄位選填更新）、刪除（pending 訂單保護）
- 訂單管理：查詢（分頁 + 狀態篩選）、詳情（含下單用戶資訊）

**前台頁面（EJS SSR）**
- 首頁（商品列表）
- 商品詳情
- 購物車
- 結帳
- 登入／註冊
- 我的訂單列表
- 訂單詳情（含模擬付款）
- 404 頁面

**後台頁面（EJS SSR）**
- 商品管理
- 訂單管理

**基礎設施**
- SQLite（WAL 模式 + 外鍵約束）
- Tailwind CSS 4.x
- OpenAPI / Swagger 文件生成（`swagger-jsdoc`）
- 整合測試（Vitest 2.x + supertest，固定執行順序）
- 統一 JSON 回應格式（`{ data, error, message }`）
- 全域錯誤處理 middleware（防止內部細節洩漏）
