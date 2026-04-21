const express = require('express');
const app = express();
app.use(express.json());

const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'real-time-amazon-data.p.rapidapi.com';

// ══════════════════════════════════════════
//  Route: POST /get-product
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
        error  : 'المنتج غير موجود',
        raw    : data,
      });
    }

    const p = data.data;

    // ── العنوان ──
    const title = p.product_title
      || p.title
      || p.name
      || 'بدون عنوان';

    // ── الوصف ──
    let description = 'لا يوجد وصف';
    if (Array.isArray(p.product_features) && p.product_features.length > 0) {
      description = p.product_features.slice(0, 4).join(' | ');
    } else if (Array.isArray(p.about_product) && p.about_product.length > 0) {
      description = p.about_product.slice(0, 4).join(' | ');
    } else if (p.product_description) {
      description = p.product_description;
    }

    // ── الصورة ── (نجرب كل الحقول الممكنة)
    let image = '';
    if (Array.isArray(p.product_photos) && p.product_photos.length > 0) {
      image = p.product_photos[0];
    } else if (p.product_main_image_url) {
      image = p.product_main_image_url;
    } else if (p.main_image) {
      image = p.main_image;
    } else if (p.image) {
      image = p.image;
    } else if (Array.isArray(p.images) && p.images.length > 0) {
      image = p.images[0];
    }

    // ── السعر ──
    const price = p.product_price
      || p.price
      || p.product_original_price
      || p.typical_price_message
      || 'تحقق من السعر على Amazon';

    return res.json({ success: true, asin, title, description, image, price });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════
//  Route: POST /debug  ← تُظهر الاستجابة الكاملة من RapidAPI
// ══════════════════════════════════════════
app.post('/debug', async (req, res) => {
  const { asin } = req.body;
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
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy يعمل على البورت ${PORT}`);
});
