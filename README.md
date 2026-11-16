# Sika Beauty

An online shop for perfumes and body creams in Accra, with an admin the owner runs from her phone.
Shoppers pay with MoMo or card through Paystack (GHS). The owner adds products, imports them from
a spreadsheet, packs and sends orders, and changes delivery fees, all without a developer.

- **Shop**: React (Vite), Tailwind CSS, Zustand, React Router. Folder: `client/`
- **API**: Node + Express. Folder: `server/`
- **Database, sign-in, photos**: Supabase (Postgres, Auth, Storage). Folder: `supabase/`
- **Payments**: Paystack, Ghana cedis, MoMo + card

Contents:
1. [Run it on your computer](#1-run-it-on-your-computer)
2. [Owner guide](#2-owner-guide)
3. [Put it online](#3-put-it-online)
4. [Before launch checklist](#4-before-launch-checklist)
5. [How payments work](#5-how-payments-work)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Run it on your computer

You need Node.js 20.6 or newer, a free [Supabase](https://supabase.com) project and a
[Paystack](https://paystack.com) account (test mode is fine).

### 1.1 Database

In Supabase, open **SQL Editor > New query** and run each file in `supabase/migrations/`
**in order**, one at a time:

1. `0001_init.sql`: tables, security rules, photo storage, sample products
2. `0002_checkout.sql`: checkout and payment functions
3. `0003_admin_orders.sql`: cancelling orders and saving settings

Each file is safe to run again.

### 1.2 Make an admin

1. Supabase > **Authentication > Users > Add user**: the owner's email and a password.
2. In the SQL Editor, run (with that email):

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'owner@example.com';
   ```

Only people in the `admins` table can use `/admin`.

### 1.3 Settings files

Copy the examples and fill them in. **Never share or commit the real `.env` files.**

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

| File | Setting | Where to find it |
|---|---|---|
| `server/.env` | `SUPABASE_URL` | Supabase > Project Settings > API |
| `server/.env` | `SUPABASE_SERVICE_ROLE_KEY` | Same page, the **secret** / service_role key. Server only. |
| `server/.env` | `PAYSTACK_SECRET_KEY` | Paystack > Settings > API Keys & Webhooks. Use `sk_test_...` while testing. |
| `server/.env` | `CLIENT_URL` | The shop address. `http://localhost:5173` on your computer. |
| `client/.env` | `VITE_API_URL` | `/` on your computer (Vite forwards `/api` to the server) |
| `client/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase > Project Settings > API, the **publishable** / anon key |
| `client/.env` | `VITE_PAYSTACK_PUBLIC_KEY` | Optional. Paystack, `pk_test_...`. The payment window opens with a one-time code from the server, so the shop works without it. |

The secret keys (`PAYSTACK_SECRET_KEY`, the Supabase service role key) live **only** in
`server/.env`. Anything starting with `VITE_` ends up in the browser, so never put a secret there.

### 1.4 Start

Two terminals:

```bash
cd server && npm install && npm run dev     # API on http://localhost:4000
cd client && npm install && npm run dev     # shop on http://localhost:5173
```

Open http://localhost:5173 for the shop and http://localhost:5173/admin for the admin.
To try it on your phone, open the "Network" address the client prints, e.g.
`http://192.168.1.20:5173` (phone and computer on the same Wi-Fi).

**Test payments** (Paystack test mode, no real money):
- Card `4084 0840 8408 4081`, any future expiry, CVV `408`. If asked: PIN `0000`, OTP `123456`.
- Mobile money: the Paystack window shows the test number to use.

---

## 2. Owner guide

Sign in at **yourshop.com/admin** with the email and password from step 1.2.
Forgot the password? Use "Forgot password?" on the sign-in page.

### Add a product

1. **Products > Add product** (on a phone: the **+** in the bottom bar).
2. **Photos**: tap to take a photo or choose from your gallery. Up to 6. Drag to reorder;
   the first one is the cover. Photos are resized automatically so the shop stays fast.
3. Name, category, brand (optional) and description.
4. **Sizes**: one row per size with price, sale price (optional) and how many you have.
   Prices are whole cedis, like `1050`.
5. Scent notes (perfumes only), then choose **Live** (in the shop) or **Hidden draft**.
6. Press **Publish product** (or **Save draft**; when editing, **Save changes**). The preview shows how it will look.

To change a product, tap it in **Products**. Use the chips to see Live, Drafts or Low stock
(any size with 3 or fewer left). Tick several products to hide, show or delete them together.

### Add many products from a spreadsheet

1. **Products > Import from spreadsheet > Download template**.
2. Fill it in Excel or Google Sheets: one row per size. Rows with the same name become one
   product with several sizes. For photos, paste a link (Google Drive or Dropbox share links work).
3. Upload the file. The review screen shows what is ready and explains any problem in plain words
   ("Price is missing"). Rows with problems are skipped.
4. Choose **Import 48 as drafts** (to check them first) or **Import and publish**.

### Orders

New paid orders appear in **Orders** under **New**, and the menu shows how many are waiting.

1. Open the order. You see the items, the delivery area and landmark, GPS address, notes,
   and the gift message if there is one.
2. Tap **WhatsApp customer** to message them. The message starts with their name and order number.
3. When it leaves: **Mark out for delivery**. When it arrives: **Mark delivered**.
   Pickup orders have **Mark picked up**. Pressed the wrong one? Use the undo link under it.

Other things you may see:
- **Needs attention** (red): something sold out between the customer paying and the order
  arriving, or a payment did not match. Read the note on the order, WhatsApp the customer to offer
  a swap or refund, then press **Mark as sorted**.
- **Unpaid**: people who started paying and stopped. Nothing to send. They are marked
  failed after 30 minutes.
- **Cancel order**: for a paid order you cannot send. Tick "put the items back in stock" if you
  still have them. **Refunds are not automatic**: refund the customer in your Paystack dashboard
  (Transactions > find the reference shown on the order > Refund).

### Overview

The first page after signing in: today's sales, orders today, products low on stock, orders still to
send out, the latest orders and the low-stock list.

### Settings

Shop name, WhatsApp number, pickup address and hours, same-day cut-off time, free delivery amount,
and delivery areas with their fees (add, remove, reorder). Press **Save settings**. The shop shows
the changes within a minute.

---

## 3. Put it online

The shop goes on **Vercel**, the API on **Render** (Railway works the same way), the database stays
on Supabase. Put the code in a GitHub repository first (the `.gitignore` already keeps `.env`
files out).

### 3.1 API on Render

1. Render > **New > Blueprint**, pick the repository. It reads `render.yaml`
   (folder `server`, start command `npm start`, health check `/api/health`).
   Or create a **Web Service** by hand with root directory `server`, build `npm ci --omit=dev`,
   start `npm start`.
2. Fill in the environment variables:

   | Variable | Value |
   |---|---|
   | `PAYSTACK_SECRET_KEY` | `sk_test_...` for now, `sk_live_...` at launch |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | as in your `server/.env` |
   | `CLIENT_URL` | the shop address, e.g. `https://sikabeauty.com` (several allowed, comma-separated) |
   | `PUBLIC_SITE_URL` | the shop address customers use, e.g. `https://sikabeauty.com` |
   | `EMAILS_ENABLED`, `RESEND_API_KEY`, `OWNER_EMAIL`, `EMAIL_FROM` | optional order emails, see 3.5 |

3. Deploy, then open `https://<your-api>.onrender.com/api/health`. It should say `{"ok":true}`.

Render's free plan falls asleep after 15 minutes without visits, so the first shopper after a
quiet spell waits about a minute. For a live shop use the paid **Starter** plan.

### 3.2 Shop on Vercel

1. Vercel > **Add New > Project**, pick the repository.
2. **Root Directory**: `client`. Framework: Vite (detected).
3. Environment variables:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | your Render address, e.g. `https://sika-api.onrender.com` (no `/api`, no trailing slash) |
   | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | as in `client/.env` |
   | `VITE_PAYSTACK_PUBLIC_KEY` | optional: `pk_test_...` for now, `pk_live_...` at launch |

4. Deploy. `client/vercel.json` makes page links like `/shop/perfume` work when opened directly
   and keeps `/admin` out of Google.
5. Add your domain in Vercel > Settings > Domains, then update `CLIENT_URL` and
   `PUBLIC_SITE_URL` on Render to match.

### 3.3 Paystack webhook (important)

The webhook is how Paystack tells the shop an order is paid, even if the customer closes their
phone before the confirmation page loads.

1. Paystack > **Settings > API Keys & Webhooks**.
2. **Webhook URL**: `https://<your-api>.onrender.com/api/paystack/webhook`
3. Save. Set it for **Test mode and Live mode** separately (there is one field for each).

You do not need to set a callback URL in Paystack: the shop sends its own for every payment.

### 3.4 Supabase sign-in settings

Supabase > **Authentication > URL Configuration**:
- **Site URL**: your shop address, e.g. `https://sikabeauty.com`
- **Redirect URLs**: add `https://sikabeauty.com/admin/reset` (and
  `http://localhost:5173/admin/reset` for testing)

Without this, "Forgot password?" emails link to the wrong place.

Supabase's built-in email sender only sends a few emails an hour. For reliable password-reset
emails set up your own SMTP in **Authentication > Emails > SMTP Settings** (Resend, Brevo or
Zoho all work).

### 3.5 Order emails (optional)

The API can email the owner on each paid order and send the customer a receipt, using
[Resend](https://resend.com). Verify your domain in Resend, then on Render set
`EMAILS_ENABLED=true`, `RESEND_API_KEY`, `OWNER_EMAIL` and `EMAIL_FROM`
(e.g. `Sika Beauty <orders@sikabeauty.com>`). Paystack also emails customers a receipt.

---

## 4. Before launch checklist

- [ ] **Settings** in the admin: real WhatsApp number, pickup address and hours, cut-off time
      (e.g. `2pm`), delivery areas and fees, free delivery amount.
- [ ] **`client/src/config/shop.js`**: email, Instagram and TikTok links, returns days (`[X]`),
      footer credit. Paste real customer reviews into `REVIEWS` (or delete them).
- [ ] **Products**: the 8 sample products are live. Hide or delete them and add the real ones.
- [ ] **Photos**: the homepage hero and category tiles use coloured placeholders until you add photos.
- [ ] **Paystack live mode**: finish business verification in Paystack, then swap to the live keys:
      `sk_live_...` on Render (and `pk_live_...` on Vercel if you set the public key; redeploy after).
      Set the **live** webhook URL (3.3).
- [ ] **Make one real small payment** with your own MoMo, check it shows as Paid in Orders and the
      stock went down, then cancel it in the admin and refund it in Paystack.
- [ ] **Order numbers**: tests used up some numbers. To start real orders at SB-1001, delete the
      test orders in Orders (or in Supabase) and run in the SQL Editor:
      `alter sequence public.order_number_seq restart with 1001;`
      (only when there are no orders left, or numbers would clash).
- [ ] Supabase **URL Configuration** and **SMTP** (3.4).
- [ ] Remove any test admin users in Supabase > Authentication > Users.

---

## 5. How payments work

For whoever maintains the code.

1. The bag stores only product size ids and quantities (in the browser), never prices.
2. `POST /api/checkout/initialize` loads every item from the database, **recomputes all prices,
   the delivery fee and the total on the server**, checks stock (a shortage returns
   "Only 2 left of Oud Noir 100ml" and the bag updates), saves the order as `pending`, and starts a
   Paystack transaction in pesewas, `GHS`, MoMo + card. The browser opens the Paystack window with
   the returned access code.
3. After paying, `/order/:reference` calls `GET /api/checkout/verify/:reference`, which asks
   Paystack, checks the status, amount and currency, and marks the order paid.
4. Paystack also calls `POST /api/paystack/webhook`. The signature (HMAC SHA512 of the raw body
   with the secret key) is checked before anything else.
5. Marking paid happens in one database function (`mark_order_paid`) that is safe to run twice,
   lowers stock (never below 0) and flags **needs attention** if stock ran out meanwhile.
6. Unpaid orders are marked failed after 30 minutes. "Try again" on the order page reuses the
   same order with a new Paystack reference.

Security: secret keys stay on the server; orders and admin data are never readable from the
browser (Row Level Security with no public policies); every `/api/admin` call checks the
Supabase sign-in and the `admins` table.

### Project layout

```
client/              shop + admin (Vite)
  src/pages/         shop pages (home, shop, product, checkout, order)
  src/admin/         admin pages and shared admin UI
  src/components/    header, footer, bag drawer, product card...
  src/stores/        Zustand stores (bag, checkout, settings, admin)
  src/config/shop.js shop name, contact links, homepage reviews
  vercel.json        hosting rules
server/              Express API
  src/routes/        products, settings, checkout, webhook, admin, import, admin orders
  src/lib/           Supabase client, Paystack, images, orders, emails
supabase/migrations/ database setup, run in order
render.yaml          Render blueprint for the API
```

---

## 6. Troubleshooting

| What you see | What to do |
|---|---|
| "Paying online is not switched on yet" at checkout | `VITE_API_URL` is missing on Vercel. Add it and redeploy. |
| "We could not reach the shop server" | The API is asleep or down. Open `/api/health` on the API address. Check `CLIENT_URL` on Render matches the shop address exactly. |
| Paystack says "Invalid key" (in the Render logs) | The secret key was cut short when pasting. It is 48 characters starting `sk_test_` or `sk_live_`. |
| Paid on Paystack but the order says Awaiting payment | Check the webhook URL (3.3) for the right mode. Opening the order page also re-checks with Paystack. |
| "This account cannot use the shop admin" | Add the user to `admins` (1.2). |
| Password reset link opens the wrong site | Supabase URL Configuration (3.4). |
| "Too many emails were sent in the last hour" | Supabase's built-in email limit. Wait an hour or set up SMTP (3.4). |
| A page link gives 404 on Vercel | Check the Vercel Root Directory is `client` so `vercel.json` is used. |
