import cors from '@elysiajs/cors';
import { Elysia, t } from 'elysia';

const PORT = Number(process.env.PORT) || 3002;

let orderCount = 0;
const processedOrders = new Map<string, number>();

const app = new Elysia()
  .use(cors())
  // Serve the interactive storefront UI
  .get('/', () => {
    return new Response(STORE_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  })

  // Products API
  .get('/api/products', () => {
    return [
      {
        id: 'prod-1',
        name: 'Cyberpunk Mechanical Keyboard',
        price: 120,
        image: '⌨️',
        stock: 5,
      },
      {
        id: 'prod-2',
        name: 'Ultra-Wide Gaming Monitor 34"',
        price: 450,
        image: '🖥️',
        stock: 3,
      },
      {
        id: 'prod-3',
        name: 'Wireless Noise-Canceling Headset',
        price: 85,
        image: '🎧',
        stock: 10,
      },
      {
        id: 'prod-4',
        name: 'RGB Ergonomic Mouse',
        price: 45,
        image: '🖱️',
        stock: 8,
      },
    ];
  })

  // BUG 4: HTTP 500 Internal Server Error when coupon is DISCOUNT99
  .post(
    '/api/coupon',
    ({ body, set }) => {
      const { code } = body as { code: string };
      if (!code) {
        set.status = 400;
        return { error: 'Coupon code is required' };
      }

      if (code.trim().toUpperCase() === 'DISCOUNT99') {
        set.status = 500;
        return {
          error: 'Unhandled Internal Error: NullPointerException in CouponValidationEngine at line 42',
          code: 500,
        };
      }

      if (code.trim().toUpperCase() === 'WELCOME10') {
        return { success: true, discount: 10, message: '10% discount applied!' };
      }

      set.status = 404;
      return { error: 'Invalid coupon code' };
    },
    {
      body: t.Object({
        code: t.String(),
      }),
    }
  )

  // BUG 1: Double-Click Checkout & Duplicate Charge
  // BUG 2: Server-side Emoji Name Crash
  .post(
    '/api/checkout',
    ({ body, set }) => {
      const { name, email, address, items, total, idempotencyKey } = body as any;

      // BUG 2: Form emoji crash
      if (name && /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(name)) {
        set.status = 500;
        throw new Error("CRASH: Unhandled UnicodeEncodingException: Name field cannot decode 4-byte UTF8 emojis 'name'");
      }

      // Check race condition / double click
      orderCount++;
      const orderId = `ORD-${Date.now()}-${orderCount}`;

      // If same idempotency key or rapid duplicate submission
      if (idempotencyKey && processedOrders.has(idempotencyKey)) {
        const count = (processedOrders.get(idempotencyKey) || 1) + 1;
        processedOrders.set(idempotencyKey, count);
        // Duplicate charge!
        return {
          success: true,
          orderId,
          duplicateCharge: true,
          chargeCount: count,
          message: `WARNING: Duplicate checkout received! Card charged ${count} times for $${total}`,
        };
      }

      if (idempotencyKey) {
        processedOrders.set(idempotencyKey, 1);
      }

      return {
        success: true,
        orderId,
        message: 'Order placed successfully!',
        total,
      };
    },
    {
      body: t.Object({
        name: t.String(),
        email: t.String(),
        address: t.String(),
        items: t.Array(t.Any()),
        total: t.Number(),
        idempotencyKey: t.Optional(t.String()),
      }),
    }
  )
  .listen(PORT);

console.log(`🛒 GlitchMart Demo Store running at http://localhost:${PORT}`);

const STORE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GlitchMart - Electronics & Gear</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; padding-bottom: 60px; }
    header { background: #1e293b; border-bottom: 1px solid #334155; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 50; }
    .brand { font-size: 22px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    .cart-pill { background: #0284c7; color: white; padding: 8px 16px; border-radius: 9999px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px; border: none; }
    .container { max-width: 1100px; margin: 32px auto; padding: 0 16px; }
    .hero { background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); border: 1px solid #312e81; border-radius: 12px; padding: 32px; margin-bottom: 32px; }
    .hero h1 { font-size: 28px; margin-bottom: 8px; color: #e2e8f0; }
    .hero p { color: #94a3b8; font-size: 15px; }
    .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 24px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; }
    .card-img { font-size: 54px; text-align: center; margin: 16px 0; }
    .card-title { font-size: 17px; font-weight: 600; margin-bottom: 8px; }
    .card-price { font-size: 20px; font-weight: 700; color: #38bdf8; margin-bottom: 16px; }
    .qty-controls { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .btn-qty { background: #334155; color: white; border: none; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; }
    .btn-add { background: #2563eb; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.2s; }
    .btn-add:hover { background: #1d4ed8; }
    
    /* Cart Modal / Section */
    .cart-section { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-top: 32px; }
    .cart-section h2 { margin-bottom: 16px; font-size: 20px; }
    .cart-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #334155; }
    .form-group { margin-top: 16px; display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 13px; color: #94a3b8; font-weight: 500; }
    .form-input { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; color: white; font-size: 14px; outline: none; }
    .form-input:focus { border-color: #38bdf8; }
    .coupon-box { display: flex; gap: 8px; margin: 16px 0; }
    .btn-coupon { background: #475569; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .btn-checkout { background: #10b981; color: white; border: none; padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; width: 100%; margin-top: 16px; }
    .btn-checkout:hover { background: #059669; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-top: 16px; display: none; }
    .alert-success { background: #064e3b; color: #a7f3d0; border: 1px solid #059669; }
    .alert-danger { background: #7f1d1d; color: #fecaca; border: 1px solid #dc2626; }
    .alert-warning { background: #78350f; color: #fde68a; border: 1px solid #d97706; }
  </style>
</head>
<body>
  <header>
    <div class="brand">🛒 GlitchMart</div>
    <button id="btn-view-cart" class="cart-pill">
      <span>Cart (<span id="cart-count">1</span>)</span>
    </button>
  </header>

  <div class="container">
    <div class="hero">
      <h1>GlitchMart Storefront</h1>
      <p>Official demo store built with deliberate real-world bugs for Gremlin chaos testing.</p>
    </div>

    <div class="products-grid">
      <div class="card" id="card-prod-1">
        <div>
          <div class="card-img">⌨️</div>
          <div class="card-title">Cyberpunk Mechanical Keyboard</div>
          <div class="card-price">$120</div>
        </div>
        <div>
          <div class="qty-controls">
            <!-- BUG 5: Negative quantity allowed -->
            <button id="btn-dec-qty-1" class="btn-qty" onclick="changeQty(1, -1)">-</button>
            <span id="qty-val-1">1</span>
            <button id="btn-inc-qty-1" class="btn-qty" onclick="changeQty(1, 1)">+</button>
          </div>
          <button id="btn-add-cart-1" class="btn-add" onclick="addToCart('prod-1', 'Cyberpunk Keyboard', 120, 1)">Add to Cart</button>
        </div>
      </div>

      <div class="card" id="card-prod-2">
        <div>
          <div class="card-img">🖥️</div>
          <div class="card-title">Ultra-Wide Gaming Monitor</div>
          <div class="card-price">$450</div>
        </div>
        <div>
          <div class="qty-controls">
            <button id="btn-dec-qty-2" class="btn-qty" onclick="changeQty(2, -1)">-</button>
            <span id="qty-val-2">1</span>
            <button id="btn-inc-qty-2" class="btn-qty" onclick="changeQty(2, 1)">+</button>
          </div>
          <button id="btn-add-cart-2" class="btn-add" onclick="addToCart('prod-2', 'Gaming Monitor', 450, 2)">Add to Cart</button>
        </div>
      </div>

      <div class="card" id="card-prod-3">
        <div>
          <div class="card-img">🎧</div>
          <div class="card-title">Noise-Canceling Headset</div>
          <div class="card-price">$85</div>
        </div>
        <div>
          <div class="qty-controls">
            <button id="btn-dec-qty-3" class="btn-qty" onclick="changeQty(3, -1)">-</button>
            <span id="qty-val-3">1</span>
            <button id="btn-inc-qty-3" class="btn-qty" onclick="changeQty(3, 1)">+</button>
          </div>
          <button id="btn-add-cart-3" class="btn-add" onclick="addToCart('prod-3', 'ANC Headset', 85, 3)">Add to Cart</button>
        </div>
      </div>
    </div>

    <!-- Checkout Section -->
    <div class="cart-section" id="checkout-section">
      <h2>Order & Checkout</h2>
      <div id="cart-items-container">
        <div class="cart-item">
          <span>Cyberpunk Mechanical Keyboard (x<span id="cart-summary-qty">1</span>)</span>
          <span id="cart-summary-price">$120</span>
        </div>
      </div>

      <div class="coupon-box">
        <input type="text" id="input-coupon" class="form-input" placeholder="Coupon Code (try DISCOUNT99)" style="flex: 1;" />
        <!-- BUG 3: Dead Click Button (empty click handler, does nothing) -->
        <button type="button" id="btn-apply-coupon" class="btn-coupon" onclick="handleCouponClick()">Apply Coupon</button>
      </div>

      <form id="checkout-form" onsubmit="event.preventDefault(); submitCheckout();">
        <div class="form-group">
          <label for="input-name">Full Name (Client crash on emoji 👾):</label>
          <input type="text" id="input-name" name="name" class="form-input" placeholder="Budi Santoso" required />
        </div>

        <div class="form-group">
          <label for="input-email">Email Address:</label>
          <input type="email" id="input-email" name="email" class="form-input" placeholder="budi@example.com" required />
        </div>

        <div class="form-group">
          <label for="input-address">Shipping Address:</label>
          <input type="text" id="input-address" name="address" class="form-input" placeholder="Jl. Sudirman No. 42" required />
        </div>

        <!-- BUG 1: Double click checkout triggers duplicate charges -->
        <button type="button" id="btn-checkout-submit" class="btn-checkout" onclick="submitCheckout()">
          Place Order ($<span id="checkout-total">120</span>)
        </button>
      </form>

      <div id="alert-box" class="alert"></div>
    </div>
  </div>

  <script>
    let quantities = { 1: 1, 2: 1, 3: 1 };
    let cart = [{ id: 'prod-1', name: 'Cyberpunk Mechanical Keyboard', price: 120, qty: 1 }];
    let checkoutClicks = 0;
    let checkoutTimer = null;

    function changeQty(id, delta) {
      // BUG 5: Allows negative numbers!
      quantities[id] = (quantities[id] || 1) + delta;
      document.getElementById('qty-val-' + id).innerText = quantities[id];
      updateTotal();
    }

    function addToCart(id, name, price, qtyKey) {
      const q = quantities[qtyKey] || 1;
      cart.push({ id, name, price, qty: q });
      document.getElementById('cart-count').innerText = cart.length;
      updateTotal();
    }

    function updateTotal() {
      let total = 0;
      for (const item of cart) {
        total += item.price * (quantities[1] !== undefined ? quantities[1] : 1);
      }
      document.getElementById('checkout-total').innerText = total;
      document.getElementById('cart-summary-qty').innerText = quantities[1];
      document.getElementById('cart-summary-price').innerText = '$' + total;
    }

    // BUG 3: Dead Click Handler - does nothing!
    function handleCouponClick() {
      const val = document.getElementById('input-coupon').value;
      if (val === 'DISCOUNT99') {
        // Trigger server 500 error
        fetch('/api/coupon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: val })
        }).then(r => {
          if (!r.ok) {
            console.error('HTTP 500 on coupon: Server exploded');
          }
        });
      }
      // Dead click: zero visual feedback, zero DOM changes!
    }

    // BUG 2: Emoji Client Crash
    function checkEmojiCrash(str) {
      if (/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(str)) {
        // Uncaught TypeError halting the UI!
        const nullObj = undefined;
        nullObj.replace(); // Throws Uncaught TypeError: Cannot read properties of undefined (reading 'replace')
      }
    }

    async function submitCheckout() {
      const name = document.getElementById('input-name').value || 'Customer';
      const email = document.getElementById('input-email').value || 'customer@example.com';
      const address = document.getElementById('input-address').value || 'Jakarta';
      const total = Number(document.getElementById('checkout-total').innerText) || 120;

      // Trigger client crash if emoji
      checkEmojiCrash(name);
      checkEmojiCrash(address);

      checkoutClicks++;
      const alertBox = document.getElementById('alert-box');

      // BUG 1: Double Click triggers duplicate charge alert
      if (checkoutClicks >= 2) {
        alertBox.className = 'alert alert-danger';
        alertBox.style.display = 'block';
        alertBox.innerHTML = '<strong>CRITICAL DUPLICATE ORDER!</strong> Double-click detected! You were charged twice: $' + (total * 2);
        console.error('Race Condition: Double checkout fired within 300ms. Charged twice: $' + (total * 2));
      } else {
        alertBox.className = 'alert alert-success';
        alertBox.style.display = 'block';
        alertBox.innerHTML = '<strong>Order Confirmed!</strong> Thank you for your purchase of $' + total;
      }

      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          address,
          items: cart,
          total,
          idempotencyKey: 'cart-session-active'
        })
      }).then(r => r.json()).then(data => {
        if (data.duplicateCharge) {
          console.error('Duplicate charge confirmed by server: ' + data.message);
        }
      }).catch(err => {
        console.error('Server error on checkout:', err);
      });

      setTimeout(() => { checkoutClicks = 0; }, 1000);
    }
  </script>
</body>
</html>`;

export default app;
