const crypto = require('crypto');
const https = require('https');

// Source: guides/13-checkmacvalue.md Node.js section (line 202-261, SNAPSHOT 2026-03)
// Node.js: encodeURIComponent does not encode ' ~ and encodes space as %20 (not +)
function ecpayUrlEncode(str) {
  let encoded = encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  const restore = { '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!', '%2a': '*', '%28': '(', '%29': ')' };
  for (const [from, to] of Object.entries(restore)) {
    encoded = encoded.split(from).join(to);
  }
  return encoded;
}

function generateCheckMacValue(params) {
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIV = process.env.ECPAY_HASH_IV;

  // Filter out any existing CheckMacValue, sort case-insensitively (per SDK naturalSort)
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const sortedKeys = Object.keys(filtered).sort(
    (a, b) => a.toLowerCase().localeCompare(b.toLowerCase())
  );
  const raw = `HashKey=${hashKey}&${sortedKeys.map(k => `${k}=${filtered[k]}`).join('&')}&HashIV=${hashIV}`;
  const encoded = ecpayUrlEncode(raw);

  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

// Source: web_fetch https://developers.ecpay.com.tw/2866.md 2026-06-13
// EncryptType=1 is required for SHA256
function buildAioFormParams(order, items) {
  const merchantId = process.env.ECPAY_MERCHANT_ID;
  const isStaging = process.env.ECPAY_ENV !== 'production';
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

  // MerchantTradeNo: alphanumeric only, max 20 chars — append 4-digit time suffix for retry uniqueness
  const baseMerchantTradeNo = order.order_no.replace(/-/g, '');
  const suffix = String(Math.floor(Date.now() / 1000) % 9999).padStart(4, '0');
  const merchantTradeNo = (baseMerchantTradeNo + suffix).slice(0, 20);

  // Taiwan time UTC+8 — ECPay rejects orders with incorrect timezone
  const now = new Date();
  const twOffset = 8 * 60 * 60 * 1000;
  const tw = new Date(now.getTime() + twOffset);
  const pad = n => String(n).padStart(2, '0');
  const merchantTradeDate = `${tw.getUTCFullYear()}/${pad(tw.getUTCMonth() + 1)}/${pad(tw.getUTCDate())} ${pad(tw.getUTCHours())}:${pad(tw.getUTCMinutes())}:${pad(tw.getUTCSeconds())}`;

  // ItemName: # delimited, max 400 chars total
  const itemName = items.map(i => `${i.product_name} x${i.quantity}`).join('#').slice(0, 400);

  const params = {
    ChoosePayment: 'ALL',
    ClientBackURL: `${baseUrl}/orders/${order.id}?payment_check=1`,
    EncryptType: 1,
    ItemName: itemName,
    MerchantID: merchantId,
    MerchantTradeDate: merchantTradeDate,
    MerchantTradeNo: merchantTradeNo,
    PaymentType: 'aio',
    ReturnURL: `${baseUrl}/api/ecpay/notify`,
    TotalAmount: order.total_amount,
    TradeDesc: '花店訂單',
  };

  params.CheckMacValue = generateCheckMacValue(params);

  const formUrl = isStaging
    ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
    : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';

  return { formUrl, params, merchantTradeNo };
}

// Source: web_fetch https://developers.ecpay.com.tw/2890.md 2026-06-13
// TradeStatus: '1'=paid, '0'=pending, others=abandoned/failed
function queryTradeInfo(merchantTradeNo) {
  const merchantId = process.env.ECPAY_MERCHANT_ID;
  const isStaging = process.env.ECPAY_ENV !== 'production';

  const timeStamp = Math.floor(Date.now() / 1000);

  const queryParams = {
    MerchantID: merchantId,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: timeStamp,
  };
  queryParams.CheckMacValue = generateCheckMacValue(queryParams);

  const body = new URLSearchParams(queryParams).toString();
  const host = isStaging ? 'payment-stage.ecpay.com.tw' : 'payment.ecpay.com.tw';

  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      path: '/Cashier/QueryTradeInfo/V5',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve(Object.fromEntries(new URLSearchParams(data)));
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { generateCheckMacValue, buildAioFormParams, queryTradeInfo };
