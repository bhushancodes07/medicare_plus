# MediCare Plus

Static storefront (HTML + CSS + vanilla JS). Open `index.html` in a browser — no build step.

## Structure
```
index.html
assets/
├── css/    base · layout · home · products · cart-modals · dark · responsive
├── js/     data · ui · products · cart · forms · main   (load order matters)
└── images/ logo · favicon · hero · banners · categories · products
            blog · testimonials · icons · payments · misc   (all empty)
```

## Adding real images
- **Products**: put the file in `assets/images/products/`, then in `assets/js/data.js`
  set `image: 'my-file.webp'` on that product.
- **Categories**: same, using `assets/images/categories/`.
- If `image` is empty or the file is missing, the emoji placeholder shows automatically.
- **Hero**: add `<img src="assets/images/hero/hero.webp" alt="">` as the first child of `.hero-main` in `index.html`.
- **Blog**: put an `<img>` inside `.blog-img` (the emoji hides itself).
- **Testimonial avatars**: put an `<img>` inside `.test-avatar`.
- **Logo**: put an `<img>` inside `.logo-icon`.

## Login setup (Supabase)
1. Create a free project at supabase.com.
2. Project Settings → API: copy the **Project URL** and the **anon public** key into `assets/js/config.js` (never the service_role key).
3. Authentication → Providers: **Email** is on by default. For **Phone OTP**, enable Phone and connect an SMS provider (e.g. Twilio).
4. Authentication → URL Configuration: set **Site URL** and add your page URL under **Redirect URLs** (needed for confirmation and password-reset links).
5. Serve the site over http(s) (e.g. VS Code "Live Server" or your hosting). Email links do not work from a `file://` page.

## Database setup (products, orders, addresses, prescriptions)
1. Supabase → **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
2. New query → paste all of `supabase/seed.sql` → **Run** (loads the 20 demo products).
3. Reload the site. Products now come from the database (edit them in **Table Editor → products**).
   If the database is unreachable the site falls back to the products in `assets/js/data.js`.

Notes
- Orders are created only by the `place_order()` database function, which recalculates prices, stock and
  totals itself, so customers cannot change prices from the browser.
- Prescriptions go to a **private** bucket; each user can only access files in their own folder.
- Card / UPI / net-banking orders are saved with `payment_status = 'pending'` until Razorpay is added.
