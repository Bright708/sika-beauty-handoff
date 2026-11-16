# Sika Beauty: Design Spec

Online shop for a perfume and body cream seller in Accra, plus an admin dashboard where the
owner adds and manages products and orders herself.

The approved mockups are in `design-reference/` (HTML with inline styles). Read them for exact
values. Ignore their `<x-dc>`, `<sc-for>`, `<sc-if>` and `{{ }}` template syntax; that is mockup
tooling. The grey/tinted blocks labelled "Product photo" are placeholders for real photos.

- `homepage.html` · shop homepage
- `product.html` · product page
- `admin-products.html` · admin product list + spreadsheet import panel
- `admin-add-product.html` · admin add/edit product form

The **bag, checkout, order confirmation and admin orders** pages have no mockup. Build them
from the rules and component specs below so they look like they belong with the rest.

## Feel

Warm, soft, feminine, premium but friendly. Blush and cocoa colours, a high-contrast serif for
headings, big rounded cards, pill buttons, lots of breathing room. Shopping should feel easy on a
phone, because most customers will come from Instagram, TikTok and WhatsApp.

## Hard rules

- **No em dashes (—) anywhere in the copy.** Use full stops, commas or "·".
- **No emoji. No gradients. No glassmorphism.** Shadows only on floating elements
  (the hero product chip, the bag drawer, toasts): `0 12px 32px rgba(36,21,15,0.12)`.
- No generic filler like "Welcome to our store". Copy is short and specific.
- One accent colour (rosewood). Don't introduce new colours.
- Every tap target at least 44px tall. Inputs at least 48px. Font size 16px in inputs (stops
  iPhone zooming in).
- Prices always as `GH₵ 1,050` (cedi sign, space, comma thousands, no decimals).

## Colour tokens

| Token | Hex | Use |
|---|---|---|
| paper | `#FBF6F2` | Shop background |
| shell | `#F6EFEA` | Admin background |
| white | `#FFFFFF` | Cards, inputs on admin, review cards |
| ink | `#24150F` | Text, primary buttons, footer, admin sidebar |
| ink-2 | `#3A2A22` | Active item in admin sidebar, dark chips |
| muted | `#6E5A50` | Secondary text |
| muted-2 | `#5E4A40` | Body text on tinted panels |
| line | `#E6D6CC` | Dividers, card borders |
| field | `#E1D0C5` | Input and chip borders |
| rose | `#A3473A` | THE accent: sale badges, pay button, low stock, icons |
| rose-light | `#E7B9A9` | Accent on dark backgrounds, logo dot |
| blush | `#F3DCD3` | Hero panel, newsletter panel |
| peach | `#E9CDBF` | Product tint |
| sand | `#EFE3D0` | Product tint |
| sage | `#E4E6D9` | Product tint |
| lilac | `#EADBE3` | Product tint |
| success | `#2F5A36` on `#E2EEDF` | "Live", "Paid", saved messages |
| danger | `#8A2F23` on `#F6DDD7` | "Sold out", errors, "Cancelled" |
| neutral | `#5E4A40` on `#EFE7E1` | "Draft", "Pending" |

The four tints (peach, sand, sage, lilac) are the background behind product photos while they
load and on product cards. Rotate them.

## Typography

Google Fonts: **Gloock** (headings, weight 400 only) + **Manrope** (400 to 800).

| Style | Font | Size | Weight |
|---|---|---|---|
| Hero H1 | Gloock | `clamp(48px, 6vw, 88px)`, line-height 1, tracking -0.02em | 400 |
| Section H2 | Gloock | `clamp(36px, 4vw, 56px)`, line-height 1.05 | 400 |
| Product page H1 | Gloock | `clamp(44px, 4.6vw, 68px)` | 400 |
| Admin page H1 | Gloock | 40px | 400 |
| Logo "Sika." | Gloock | 32px header, 40px footer; the dot is rose | 400 |
| Card product name | Manrope | 17px | 700 |
| Price | Manrope | 17px (cards), Gloock 40px (product page) | 800 |
| Labels / small caps text | Manrope | 13px | 600 to 700 |
| Body | Manrope | 16 to 18px, line-height 1.55 | 400 |
| Admin card headings | Manrope | 18px | 800 |

## Shape and spacing

- Container: `max-width: 1320px`, side padding `clamp(16px, 4vw, 40px)`.
- Radius: big panels 28px, cards and product images 22px, admin cards 20px, small tiles 16px,
  inputs 12px, buttons and chips `999px` (pills).
- Section spacing: 96px between homepage sections.
- Product grid: `repeat(auto-fill, minmax(min(260px, 100%), 1fr))`, gap 36px rows / 20px columns.
  Two columns on phones (use `minmax(160px, 1fr)` under 640px so phones show 2 across).

## Components

**Buttons**: pills. Primary = ink bg, paper text. Secondary = 1.5px ink border, transparent.
Pay = rose bg, white text. Heights 48 to 56px, 14 to 16px, weight 700 to 800.
Hover: primary goes to `#3A2A22`; secondary fills ink with paper text. 150ms.

**Product card**: 4:5 image with 22px radius on a tint, rose "-19%" pill top-left when on sale,
then type label (muted 13px), name (17px/700, links to product), price (800) with struck-through
old price, then full-width secondary pill "Add to bag". Out of stock: button disabled, reads
"Sold out", image at 60% opacity.

**Chips / filters**: pill, 44px, active = ink fill.

**Toast**: bottom centre on phone, top right on desktop, ink bg, paper text, 20px radius,
"Added to your bag · View bag".

**Status pills** (admin): success / neutral / danger colours from the table above, 13px/800.

## Shop pages

### Homepage (`/`): match `homepage.html`
Announcement bar → header (logo, nav, search, account, bag count) → split hero (blush panel with
headline "Smell like you meant it.", 2 buttons; photo panel with floating product chip) →
4 category tiles → "Trending now" grid with All / Perfumes / Body creams chips → 2 promo
panels (Gift sets, The routine) → "Best sellers" → reviews (real reviews only, placeholders until
then) → 3 reasons (same-day delivery, pay with MoMo, authentic only) → newsletter → footer.
Mobile: hamburger opens a full-height paper drawer with large Gloock links.

### Category / shop all (`/shop`, `/shop/:category`)
Same header. Gloock H1 with the category name and product count. Chips for sub-filters
(category, on sale, in stock). Sort select (Newest, Price low to high, Price high to low).
Product grid. "Load more" button (not infinite scroll).

### Product page (`/product/:slug`): match `product.html`
Gallery with thumbnails (swipe on phone), type label, Gloock name, one-line description,
price (sale + struck old price), size pills that change price and stock, quantity stepper,
"Add to bag · GH₵ X", "Order on WhatsApp instead" (opens wa.me with product name, size and
link pre-filled), delivery + payment mini cards, accordions (Scent notes only for perfumes,
How to wear it, Delivery and returns), "Make it last longer" related products.
If the chosen size has 1 to 3 in stock, show "Only 2 left" in rose under the price.

### Bag drawer (no mockup)
Slides in from the right (full screen on phones), paper bg, 28px left radius on desktop.
Header "Your bag (3)" in Gloock 32px + close button. Each line: 72x88 tinted image, name,
size, price, quantity stepper, "Remove" text button. Free-delivery nudge if a threshold is set
in settings: "Add GH₵ 120 more for free delivery". Footer: Subtotal, note "Delivery calculated at
checkout", primary "Checkout" pill, secondary "Continue shopping".

### Checkout (`/checkout`), single page (no mockup)
Two columns on desktop (form left, order summary right in a white 22px card); summary collapses
into a "Show order summary · GH₵ 1,230" bar at the top on phones.
1. **Contact**: full name, phone (WhatsApp) with +233 default, email (needed for Paystack receipt).
2. **Delivery**: pill choice "Deliver to me" / "Pick up". Deliver: delivery zone select
   (zones and fees come from admin settings, e.g. "Accra Central · GH₵ 30"), area/landmark,
   GhanaPost GPS address (optional), delivery notes. Pick up: show pickup address and hours.
3. **Gift**: checkbox "This is a gift" reveals a card message textarea (max 200 characters).
4. **Pay**: summary of subtotal, delivery, total, then a rose pill "Pay GH₵ 1,230" and a line
   "MoMo or card · Secured by Paystack". No card fields on our page; Paystack's popup handles it.

### Order confirmation (`/order/:reference`)
Gloock "Thank you, Ama." Order number, items, total paid, delivery details, "We'll WhatsApp you
when it's on the way." Button "Continue shopping". If payment failed: "Payment didn't go through"
with "Try again" (reuses the same order) and "Order on WhatsApp".

## Admin pages (`/admin/*`)

Desktop: ink sidebar on the left (logo + "Admin", Overview, Orders with count of new orders,
Products, Customers, Discounts, Settings, "View shop" at the bottom). Phones: sidebar becomes a
bottom tab bar with Orders, Products, Add (+), Settings.

### Login (`/admin/login`)
Centred white card on shell bg, logo, email + password, "Sign in". Forgot password link.

### Products (`/admin/products`): match `admin-products.html`
H1 + count, "Import from spreadsheet" (secondary) and "Add product" (primary). Filter chips
(All, Live, Drafts, Low stock) with counts, search. Table in a white 20px card (horizontal scroll
on phones, or a card list under 640px). Stock ≤ 3 shows "2 left" in rose. Row click or Edit goes to
the edit form. Bulk select with "Hide", "Show", "Delete" actions.

### Add / edit product (`/admin/products/new`, `/admin/products/:id`): match `admin-add-product.html`
Photos (multi upload, drag to reorder, first = cover, max 6), name, category, brand (optional),
description, sizes table (size, price, sale price, stock; add/remove rows), scent notes (only
for Perfume), visibility (Live / Hidden draft), Publish/Save button, live card preview.
Edit mode adds a "Delete product" danger text button at the bottom with a confirm dialog.

### Spreadsheet import (panel on Products page, then a review screen)
Step 1 download template, step 2 fill it, step 3 upload .xlsx or .csv. Then a **review screen**:
"48 products ready · 2 need fixing". Table with a status pill per row and the error in plain words
("Price is missing", "Category must be one of: Perfume, Body cream…"). Buttons: "Import 48 as
drafts" (primary) and "Import and publish". Rows with errors are skipped.

### Orders (`/admin/orders`) (no mockup)
Filter chips: New, Paid, Out for delivery, Delivered, Cancelled (with counts). Table/cards:
order number, customer name + phone (tap to WhatsApp), items count, total, delivery zone,
payment status pill, order status pill, time ("12 min ago"). Order detail page: items, customer,
delivery info, gift message, Paystack reference, buttons to move status forward
("Mark out for delivery", "Mark delivered"), and "WhatsApp customer".

### Overview (`/admin`)
Four stat cards: Today's sales (GH₵), Orders today, Products low on stock, Unfulfilled orders.
Below: latest 5 orders and the low-stock list. No charts needed in v1.

### Settings (`/admin/settings`)
Shop name, WhatsApp number, pickup address and hours, delivery zones (name + fee, add/remove),
free delivery threshold (optional), same-day cut-off time.
