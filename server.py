from flask import Flask, request, jsonify
import requests
import re
import os

app = Flask(__name__)

RAPIDAPI_KEY  = os.environ.get("RAPIDAPI_KEY")

def extract_asin(text: str):
    """يستخرج ASIN من أي صيغة رابط Amazon"""
    patterns = [
        r"/dp/([A-Z0-9]{10})",
        r"/gp/product/([A-Z0-9]{10})",
        r"asin=([A-Z0-9]{10})",
        r"/([A-Z0-9]{10})(?:/|\?|$)",
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            return m.group(1)
    return None

@app.route("/get-product", methods=["POST"])
def get_product():
    body = request.get_json(force=True) or {}

    # ✅ يقبل "asin" مباشرة أو "url" كامل
    asin = body.get("asin") or extract_asin(body.get("url", ""))

    if not asin:
        return jsonify({"success": False, "error": "ASIN غير صالح"}), 400

    url = "https://real-time-amazon-data.p.rapidapi.com/product-details"
    headers = {
        "X-RapidAPI-Key":  RAPIDAPI_KEY,
        "X-RapidAPI-Host": "real-time-amazon-data.p.rapidapi.com",
    }
    params = {"asin": asin, "country": "US"}

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json().get("data", {})

        about   = data.get("about_product", [])
        description = about[0] if about else data.get("product_description", "")
        photos  = data.get("product_photos", [])
        image   = photos[0] if photos else data.get("product_main_image_url", "")

        return jsonify({
            "success": True,
            "data": {
                "title":       data.get("product_title", ""),
                "description": description[:500] if description else "",
                "price":       data.get("product_price", data.get("typical_price_message", "")),
                "image":       image,
                "asin":        asin,
            }
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
