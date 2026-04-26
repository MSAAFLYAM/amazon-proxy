const express = require('express');
const app = express();
app.use(express.json());

const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'real-time-amazon-data.p.rapidapi.com';

function extractAsin(input) {
  if (!input) return null;
  if (/^[A-Z0-9]{10}$/.test(input.trim())) return input.trim();
  const match = input.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : null;
}

app.post('/get-product', async (req, res) => {
  const input = req.body.url || req.body.asin || '';
  const asin = extractAsin(input);
  if (!asin) return res.status(400).json({ success: false, error: 'Invalid Amazon URL' });

  try {
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/product-details?asin=${asin}&country=US`,
      { headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': RAPIDAPI_HOST } }
    );
    const data = await response.json();
    if (!data || data.status !== 'OK' || !data.data || !data.data.product_title) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    const p = data.data;
    return res.json({
      success: true,
      title: p.product_title || '',
      description: (p.about_product || []).slice(0, 3).join(' | ') || '',
      image: (p.product_photos || [])[0] || p.product_photo || '',
      price: p.product_price ? `$${p.product_price}` : 'See on Amazon',
      rating: p.product_star_rating || ''
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', hasKey: !!RAPIDAPI_KEY }));
app.listen(process.env.PORT || 3000, () => console.log('✅ Running'));
