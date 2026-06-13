const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const { generateCheckMacValue } = require('../services/ecpayService');

const router = express.Router();

// ReturnURL S2S callback from ECPay (AIO form POST, not JSON)
// Cannot be reached from localhost, but implemented for future deployment.
// Source: guides/13-checkmacvalue.md Callback 驗證 + AIO 注意事項 (2858.md)
router.post('/notify', express.urlencoded({ extended: false }), (req, res) => {
  res.set('Content-Type', 'text/plain');

  const body = { ...req.body };
  const received = body.CheckMacValue || '';
  delete body.CheckMacValue;

  const expected = generateCheckMacValue(body);

  // timing-safe comparison to prevent timing attacks
  const a = Buffer.from(received.toUpperCase());
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(200).send('0|CheckMacValue Error');
  }

  const { MerchantTradeNo, RtnCode } = body;
  const order = db.prepare('SELECT id, status FROM orders WHERE ecpay_merchant_trade_no = ?').get(MerchantTradeNo);

  if (order && order.status === 'pending') {
    const newStatus = String(RtnCode) === '1' ? 'paid' : 'failed';
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, order.id);
  }

  // Must return exactly "1|OK" with HTTP 200 — any other format triggers ECPay retry (up to 4x)
  return res.status(200).send('1|OK');
});

module.exports = router;
