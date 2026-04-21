// ============================================
// server.js — Amazon PA API Proxy
// يُرفع على Railway.app مجاناً
// ============================================

const express = require('express');
const crypto  = require('crypto');

const app = express();
app.use(express.json());

// ── مفاتيح Amazon (تُحفظ في Railway Environment Variables) ──
const CONFIG = {
  accessKey  : process.env.AMAZON_ACCESS_KEY,
  secretKey  : process.env.AMAZON_SECRET_KEY,
  partnerTag : process.env.AMAZON_PARTNER_TAG,
  host       : process.env.AMAZON_HOST       || 'webservices.amazon.com',
  region     : process.env.AMAZON_REGION     || 'us-east-1',
  marketplace: process.env.AMAZON_MARKETPLACE|| 'www.amazon.com',
};

// ══════════════════════════════════════════
//  دوال AWS Signature Version 4
// ══════════════════════════════════════════

function hmac(key, data, encoding) {
  return crypto.createHmac('sha256', key).update(data).digest(encoding);
}

function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getSignatureKey(secret, dateStamp) {
  const kDate    = hmac('AWS4' + secret, dateStamp);
  const kRegion  = hmac(kDate,   CONFIG.region);
  const kService = hmac(kRegion, 'ProductAdvertisingAPI');
  return           hmac(kService,'aws4_request');
}

function buildAuthHeader(amzDate, dateStamp, payloadHash) {
  const credentialScope = `${dateStamp}/${CONFIG.region}/ProductAdvertisingAPI/aws4_request`;

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=UTF-8\n` +
    `host:${CONFIG.host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems\n`;

  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';

  const canonicalRequest = [
    'POST',
    '/paapi5/getitems',
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hash(canonicalRequest),
  ].join('\n');

  const sigKey   = getSignatureKey(CONFIG.secretKey, dateStamp);
  const signature = hmac(sigKey, stringToSign, 'hex');

  return `AWS4-HMAC-SHA256 Credential=${CONFIG.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

// ══════════════════════════════════════════
//  Route: POST /get-product
//  Body: { "asin": "B08N5WRWNW" }
// ══════════════════════════════════════════

app.post('/get-product', async (req, res) => {
  const { asin } = req.body;

  // ── التحقق من المدخلات ──
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
    return res.status(400).json({ success: false, error: 'ASIN غير صالح' });
  }

  const payload = JSON.stringify({
    ItemIds    : [asin],
    Resources  : [
      'Images.Primary.Large',
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'ItemInfo.Features',
      'ItemInfo.ProductInfo',
      'Offers.Listings.Price',
    ],
    PartnerTag  : CONFIG.partnerTag,
    PartnerType : 'Associates',
    Marketplace : CONFIG.marketplace,
  });

  // ── توقيت الطلب ──
  const now       = new Date();
  const amzDate   = now.toISOString().replace(/[-:]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const payHash   = hash(payload);
  const authHdr   = buildAuthHeader(amzDate, dateStamp, payHash);

  const endpoint = `https://${CONFIG.host}/paapi5/getitems`;

  try {
    const response = await fetch(endpoint, {
      method : 'POST',
      headers: {
        'content-encoding': 'amz-1.0',
        'content-type'    : 'application/json; charset=UTF-8',
        'host'            : CONFIG.host,
        'x-amz-date'      : amzDate,
        'x-amz-target'    : 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
        'Authorization'   : authHdr,
      },
      body: payload,
    });

    const data = await response.json();

    // ── التحقق من استجابة Amazon ──
    if (!data.ItemsResult || !data.ItemsResult.Items?.length) {
      return res.status(404).json({
        success: false,
        error  : 'المنتج غير موجود أو ASIN خاطئ',
        raw    : data,
      });
    }

    const item = data.ItemsResult.Items[0];

    // ── استخراج البيانات ──
    const title = item.ItemInfo?.Title?.DisplayValue ?? 'بدون عنوان';

    const features = item.ItemInfo?.Features?.DisplayValues ?? [];
    const description = features.slice(0, 4).join(' | ') || 'لا يوجد وصف';

    const imageHigh = item.Images?.Primary?.Large?.URL  ?? '';
    const imageMed  = item.Images?.Primary?.Medium?.URL ?? '';
    const image     = imageHigh || imageMed;

    const price = item.Offers?.Listings?.[0]?.Price?.DisplayAmount ?? 'تحقق من السعر على Amazon';

    // ── الرد النظيف ──
    return res.json({
      success    : true,
      asin,
      title,
      description,
      image,
      price,
      marketplace: CONFIG.marketplace,
    });

  } catch (err) {
    console.error('خطأ في الاتصال بـ Amazon API:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════
//  Route: GET /health  (للتحقق من عمل السيرفر)
// ══════════════════════════════════════════

app.get('/health', (_req, res) => {
  res.json({
    status   : 'ok',
    timestamp: new Date().toISOString(),
    config   : {
      host       : CONFIG.host,
      marketplace: CONFIG.marketplace,
      region     : CONFIG.region,
      hasKeys    : !!(CONFIG.accessKey && CONFIG.secretKey && CONFIG.partnerTag),
    },
  });
});

// ══════════════════════════════════════════
//  تشغيل السيرفر
// ══════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy يعمل على البورت ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
