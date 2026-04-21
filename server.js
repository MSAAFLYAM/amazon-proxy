// ============================================
// server.js — Amazon Data Proxy via RapidAPI
// يُرفع على Railway.app
// ============================================

const express = require('express');
const app = express();
app.use(express.json());

const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'real-time-amazon-data.p.rapidapi.com';

// ══════════════════════════════════════════
//  Route: POST /get-product
//  Body: { "asin": "B08N5WRWNW" }
// ══════════════════════════════════════════

app.post('/get-product', async (req, res) => {
  const { asin } = req.body;

  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
    return res.status(400).json({ success: false, error: 'ASIN غير صالح' });
  }

  try {
    const url = `https://${RAPIDAPI_HOST}/product-details?asin=${asin}&country=US`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key' : RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
    });

    const data = await response.json();

    if (!data || data.status !== 'OK' || !data.data) {
      return res.status(404).json({
        success: false,
        error  : 'المنتج غير موجود أو ASIN خاطئ',
        raw    : data,
      });
    }

    const product = data.data;

    const title = product.product_title ?? 'بدون عنوان';

    const features = product.product_features ?? [];
    const description = features.length > 0
      ? features.slice(0, 4).join(' | ')
      : (product.product_description ?? 'لا يوجد وصف');

    const photos  = product.product_photos ?? [];
    const mainImg = product.product_main_image_url ?? '';
    const image   = photos[0] ?? mainImg ?? '';

    const price = product.product_price
      ?? product.product_original_price
      ?? 'تحقق من السعر على Amazon';

    return res.json({
      success    : true,
      asin,
      title,
      description,
      image,
      price,
    });

  } catch (err) {
    console.error('خطأ في RapidAPI:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════
//  Route: GET /health
// ══════════════════════════════════════════

app.get('/health', (_req, res) => {
  res.json({
    status   : 'ok',
    provider : 'RapidAPI - Real-Time Amazon Data',
    timestamp: new Date().toISOString(),
    hasKey   : !!RAPIDAPI_KEY,
  });
});

// ══════════════════════════════════════════
//  تشغيل السيرفر
// ══════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy يعمل على البورت ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});
