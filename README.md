# KadeCloud

KadeCloud is a Sri Lanka-focused e-commerce management SaaS for small sellers.

This repository contains the initial full-stack project scaffold:

- `client` - React, Vite, and Tailwind CSS
- `server` - Node.js and Express REST API
- `database` - PostgreSQL schema files

## Prerequisites

- Node.js 20+
- npm 9+
- PostgreSQL 14+

## Setup

Install dependencies from the repository root:

```bash
npm install
```

Create the server environment file:

```bash
cp server/.env.example server/.env
```

Update `server/.env` if your PostgreSQL username, password, host, port, or database name differs.

## Database Setup

Create the PostgreSQL database:

```bash
createdb kadecloud
```

Load the schema and apply migrations. On a fresh (empty) database the migrate
command loads `database/schema.sql` automatically before applying migrations,
so a single command bootstraps everything:

```bash
npm run migrate -w server
```

This is safe to re-run: it detects an already-loaded schema and only applies
pending migrations. (You can still load the base schema manually with
`psql "$DATABASE_URL" -f database/schema.sql` if you prefer.)

The backend reads the database connection from `DATABASE_URL` in `server/.env`.

If you loaded an earlier schema during development, recreate the local database or apply equivalent `ALTER TABLE` changes before using product management.
The checkout flow also expects the latest schema values for `orders.status = 'new'`, `orders.cod_status = 'not_verified'`, `customers.district`, `orders.delivery_district`, and `kadecloud_order_number_seq`.
Seller order management expects the latest order status and COD status enums plus `orders.seller_notes`, `orders.stock_reduced_at`, and `delivery_updates.status` using order statuses.
Customer risk calculation expects `customer_risk_status` values `new`, `trusted`, `medium_risk`, and `high_risk`.
Inventory adjustment logs expect `inventory_logs.adjustment_type` and `inventory_logs.reason`.

Set a long random value for `JWT_SECRET` before testing authenticated routes:

```bash
JWT_SECRET=replace-this-with-a-long-random-secret
```

## Development

Run both the client and server:

```bash
npm run dev
```

Run only the client:

```bash
npm run dev:client
```

Run only the server:

```bash
npm run dev:server
```

The client runs at `http://localhost:5173`.

The server runs at `http://localhost:5001`.

Frontend auth routes:

- `http://localhost:5173/login`
- `http://localhost:5173/register`
- `http://localhost:5173/dashboard`
- `http://localhost:5173/store/STORE_SLUG`
- `http://localhost:5173/store/STORE_SLUG/product/PRODUCT_ID`

The client calls `http://localhost:5001/api` by default. To point it at a different backend URL, set `VITE_API_BASE_URL` before starting the client.

Health check:

```bash
curl http://localhost:5001/api/health
```

Database connection test:

```bash
curl http://localhost:5001/api/db-test
```

## Auth API

Register a Store Admin. This also creates the Store Admin's store automatically and generates a unique store slug from `businessName`.

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Store Admin",
    "email": "storeadmin@example.com",
    "phone": "0771234567",
    "businessName": "Kade Fashion",
    "businessCategory": "Clothing",
    "password": "Password123"
  }'
```

Login:

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nimali@example.com",
    "password": "password123"
  }'
```

Get the authenticated user:

```bash
curl http://localhost:5001/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Products API

All product routes require a Store Admin or seller JWT.

List products:

```bash
curl "http://localhost:5001/api/products?search=kurti&category=Clothing&status=active" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Create a product:

```bash
curl -X POST http://localhost:5001/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Cotton Kurti",
    "sku": "KF-001",
    "category": "Clothing",
    "description": "Comfortable daily wear kurti",
    "price": 2500,
    "discount_price": 2200,
    "stock_quantity": 12,
    "low_stock_threshold": 3,
    "image_url": "https://example.com/product.jpg",
    "cod_available": true,
    "is_active": true
  }'
```

Upload a product image from a device:

```bash
curl -X POST http://localhost:5001/api/uploads/product-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "data_url": "data:image/png;base64,BASE64_IMAGE_DATA"
  }'
```

The response includes an `image_url` that can be used as the product cover image
or a gallery image. The dashboard product form also supports choosing JPG, PNG,
or WebP images directly from the device. Uploaded files are stored under
`server/uploads/products` and served from `/uploads/products/...`.

Update, view, and delete use:

```bash
curl http://localhost:5001/api/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Public Storefront API

Public storefront routes do not require authentication.

Get a store:

```bash
curl http://localhost:5001/api/public/stores/kade-fashion
```

List public products:

```bash
curl "http://localhost:5001/api/public/stores/kade-fashion/products?search=kurti&category=Clothing"
```

Get product detail:

```bash
curl http://localhost:5001/api/public/stores/kade-fashion/products/PRODUCT_ID
```

Create a COD order:

```bash
curl -X POST http://localhost:5001/api/public/orders \
  -H "Content-Type: application/json" \
  -d '{
    "store_slug": "kade-fashion",
    "product_id": "PRODUCT_ID",
    "name": "Customer Name",
    "phone": "0771234567",
    "address": "No 10, Main Street",
    "city": "Colombo",
    "district": "Colombo",
    "notes": "Call before delivery",
    "quantity": 1,
    "selected_variant": "Default",
    "payment_method": "cod"
  }'
```

Track a public order:

```bash
curl http://localhost:5001/api/public/track/KC-000001
```

Customers can also open `/track/KC-000001` in the client to view the current
status, delivery timeline, last updated date, and seller contact action.

## Store Orders API

All store order routes require a Store Admin or seller JWT.

List orders:

```bash
curl http://localhost:5001/api/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

View an order:

```bash
curl http://localhost:5001/api/orders/ORDER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Update order status:

```bash
curl -X PUT http://localhost:5001/api/orders/ORDER_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"status": "confirmed"}'
```

Update COD status:

```bash
curl -X PUT http://localhost:5001/api/orders/ORDER_ID/cod-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"cod_status": "phone_confirmed"}'
```

Save seller notes:

```bash
curl -X PUT http://localhost:5001/api/orders/ORDER_ID/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"seller_notes": "Customer answered and confirmed delivery address."}'
```

Supported order statuses are `new`, `pending_confirmation`, `confirmed`, `packed`, `dispatched`, `out_for_delivery`, `delivered`, `returned`, `rejected`, and `cancelled`.

Supported COD statuses are `not_verified`, `phone_confirmed`, `whatsapp_confirmed`, `no_answer`, `suspicious`, and `fake_order`.

Customer risk is recalculated when COD status changes and when order status changes to `delivered`, `returned`, `rejected`, or `cancelled`.

Every order status change is recorded in `delivery_updates`, which powers
the public tracking page and the seller delivery page at `/dashboard/delivery`.

Risk rules:

- `trusted`: customer has delivered orders and no rejected, returned, or fake orders
- `new`: customer has no meaningful risk history yet
- `medium_risk`: customer has 2 or more rejected/returned orders
- `high_risk`: customer has any fake order COD status

View customers:

```bash
curl http://localhost:5001/api/customers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

View customer detail:

```bash
curl http://localhost:5001/api/customers/CUSTOMER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Inventory API

All inventory routes require a Store Admin or seller JWT.

View inventory:

```bash
curl http://localhost:5001/api/inventory \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Create a manual stock adjustment:

```bash
curl -X POST http://localhost:5001/api/inventory/adjust \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "product_id": "PRODUCT_ID",
    "adjustment_type": "add",
    "quantity": 5,
    "reason": "Restock",
    "note": "Supplier delivery received"
  }'
```

View inventory logs:

```bash
curl http://localhost:5001/api/inventory/logs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Store Settings API

Store settings routes require a Store Admin JWT.

```bash
curl http://localhost:5001/api/stores/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

```bash
curl -X PUT http://localhost:5001/api/stores/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Kade Fashion",
    "phone": "0771234567",
    "description": "Clothing and accessories",
    "address": "No 10, Main Street",
    "city": "Colombo",
    "district": "Colombo",
    "logo_url": "https://example.com/logo.png"
  }'
```

Connect a WhatsApp Business catalog:

```bash
curl -X PUT http://localhost:5001/api/stores/me/meta-catalog \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer STORE_ADMIN_JWT_TOKEN" \
  -d '{
    "meta_catalog_id": "META_CATALOG_ID",
    "meta_access_token": "META_ACCESS_TOKEN",
    "meta_currency": "LKR",
    "whatsapp_phone": "0771234567"
  }'
```

Sync current storefront products to the connected WhatsApp catalog:

```bash
curl -X POST http://localhost:5001/api/stores/me/sync-catalog \
  -H "Authorization: Bearer STORE_ADMIN_JWT_TOKEN"
```

Disconnect the catalog:

```bash
curl -X DELETE http://localhost:5001/api/stores/me/meta-catalog \
  -H "Authorization: Bearer STORE_ADMIN_JWT_TOKEN"
```

Store Admins can also connect and sync from `/dashboard/settings`. Product
creates, updates, and deletes will sync in the background after a catalog is
connected. For local development set `PUBLIC_BASE_URL` to the public client URL
that Meta can access, because catalog product URLs and image fallbacks use it.

## Super Admin API

KadeCloud uses the `platform_admin` role as the super admin role. Create the
first super admin directly in PostgreSQL. Super admins can create Store Admin
accounts and attach seller accounts to a store, but they cannot create more
super admins from the UI/API.

```sql
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Super Admin',
  'admin@example.com',
  crypt('Password123', gen_salt('bf')),
  'platform_admin'
);
```

List accounts:

```bash
curl http://localhost:5001/api/admin/accounts \
  -H "Authorization: Bearer SUPER_ADMIN_JWT_TOKEN"
```

Create a seller account:

```bash
curl -X POST http://localhost:5001/api/admin/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPER_ADMIN_JWT_TOKEN" \
  -d '{
    "name": "Test Seller",
    "email": "seller2@example.com",
    "password": "Password123",
    "role": "seller",
    "store_id": "STORE_ID"
  }'
```

Create a Store Admin and new store:

```bash
curl -X POST http://localhost:5001/api/admin/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPER_ADMIN_JWT_TOKEN" \
  -d '{
    "name": "Store Admin",
    "email": "admin-store@example.com",
    "password": "Password123",
    "role": "store_admin",
    "businessName": "Kade Fashion 2",
    "businessCategory": "Clothing",
    "phone": "0771234567",
    "city": "Colombo",
    "district": "Colombo"
  }'
```

Store Admins can also use `/dashboard/admin/accounts` to create seller accounts
for their own store.

Log in as a Store Admin or seller:

```bash
curl -X POST http://localhost:5001/api/admin/accounts/STORE_ACCOUNT_USER_ID/login-as \
  -H "Authorization: Bearer SUPER_ADMIN_JWT_TOKEN"
```

The frontend admin page is available at `/dashboard/admin/accounts`. When a
super admin logs in as a store account, the header shows the active session and
a return-to-admin action.

## Existing Database Migration

For an existing database created before Store Admin roles were added, run:

```bash
psql "$DATABASE_URL" -f database/migrations/2026-05-17-store-admin-roles.sql
```

## Build

Build the client:

```bash
npm run build
```
