const express = require('express');
const app = express();
app.use(express.json());

const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'real-time-amazon-data.p.rapidapi.com';

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

    if (!data || data.status !== 'OK' || !data.data || Object.keys(data.data).length === 0) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود أو ASIN خاطئ' });
    }

    const p = data.data;

    // ── العنوان ──
    const title = p.product_title || 'بدون عنوان';

    // ── الوصف من about_product ──
    let description = 'لا يوجد وصف';
    if (Array.isArray(p.about_product) && p.about_product.length > 0) {
      description = p.about_product.slice(0, 4).join(' | ');
    } else if (Array.isArray(p.product_features) && p.product_features.length > 0) {
      description = p.product_features.slice(0, 4).join(' | ');
    }

    // ── الصورة ── product_photos أو product_photo
    let image = '';
    if (Array.isArray(p.product_photos) && p.product_photos.length > 0) {
      image = p.product_photos[0];
    } else if (p.product_photo) {
      image = p.product_photo;
    }

    // ── السعر مع العملة ──
    let price = 'تحقق من السعر على Amazon';
    if (p.product_price) {
      const currency = p.currency || 'USD';
      const symbol = currency === 'USD' ? '$' : currency;
      price = `${symbol}${p.product_price}`;
    }

    // ── التقييم ──
    const rating = p.product_star_rating || '';
    const numRatings = p.product_num_ratings || '';

    return res.json({
      success    : true,
      asin,
      title,
      description,
      image,
      price,
      rating,
      numRatings,
      productUrl : p.product_url || `https://www.amazon.com/dp/${asin}`,
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

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

app.get('/health', (_req, res) => {
  res.json({
    status   : 'ok',
    provider : 'RapidAPI - Real-Time Amazon Data',
    timestamp: new Date().toISOString(),
    hasKey   : !!RAPIDAPI_KEY,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Port ${PORT}`));
