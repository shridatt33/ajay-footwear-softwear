# SWAMIDATT ENTERPRISES ERP & POS — Production Deployment Guide

This guide details the complete, step-by-step production deployment for the **SWAMIDATT ENTERPRISES ERP POS Billing System** on [Render](https://render.com).

---

## 1. Architecture Overview

| Component | Technology | Target Platform | Production Role |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | Render Static Site | Responsive Web POS, Customer Management, Billing, Reports, Developer Dashboard |
| **Backend** | Python Flask + psycopg3 + Gunicorn | Render Web Service | RESTful API, Auth, POS Engine, Barcodes, Inventory, Reports |
| **Database** | PostgreSQL 16+ | Render Managed PostgreSQL | Persistent relational storage, Size-wise stock, Users, Audit logs, Invoices |
| **Invoice Storage** | PostgreSQL (`bills.pdf_data`) | Render Managed PostgreSQL | Permanent Base64 PDF storage (bypasses ephemeral cloud disk) |
| **Desktop Client** | Electron + NSIS | Windows Desktop | Standalone offline/hybrid POS workstation client |

---

## 2. Infrastructure Deployment Steps (Render)

### Option A: Automated Deployment via Blueprint (`render.yaml`)

The repository includes a ready-to-use [`render.yaml`](./render.yaml) file.
1. Connect your GitHub repository (`shridatt33/ajay-footwear-softwear`) to your Render account.
2. In the Render Dashboard, click **New +** -> **Blueprint**.
3. Select this repository and click **Apply**.
4. Render will automatically provision:
   - PostgreSQL database (`swamidatt-footwear-db`)
   - Flask Web Service (`swamidatt-footwear-api`)
   - Static Site (`swamidatt-footwear-web`)
5. After the static site is provisioned, update `CORS_ORIGINS` in the backend service and `VITE_API_BASE_URL` in the static site settings as described below.

---

### Option B: Manual Step-by-Step Deployment

#### Step 1: Provision Render PostgreSQL Database
1. In the Render Dashboard, click **New +** -> **PostgreSQL**.
2. Set the following fields:
   - **Name:** `swamidatt-footwear-db`
   - **Database:** `ajay_footwear`
   - **User:** `ajay_user`
   - **Region:** Choose the region closest to your shop (e.g., *Singapore / Oregon / Frankfurt*).
   - **PostgreSQL Version:** 16 (or latest default).
   - **Plan:** Free or Starter.
3. Once created, go to the database **Info** tab and copy:
   - **Internal Database URL** (e.g. `postgresql://ajay_user:***@dpg-xxx-a:5432/ajay_footwear`) for the backend web service.
   - **External Database URL** (used if you need to run migrations or manual administration from a local terminal).

---

#### Step 2: Deploy Flask Backend Web Service
1. In the Render Dashboard, click **New +** -> **Web Service**.
2. Select your GitHub repository (`shridatt33/ajay-footwear-softwear`).
3. Set the following configuration:
   - **Name:** `swamidatt-footwear-api`
   - **Region:** Same region as your database.
   - **Branch:** `main`
   - **Root Directory:** (leave blank or specify repository root)
   - **Runtime:** `Python 3`
   - **Build Command:**
     ```bash
     pip install -r backend/requirements.txt
     ```
   - **Start Command:**
     ```bash
     cd backend && gunicorn app:app --bind 0.0.0.0:$PORT --workers 4 --threads 2 --timeout 120
     ```
   - **Plan:** Free or Starter.
4. Add the following **Environment Variables** in the service settings:
   - `DATABASE_URL`: Paste the **Internal Database URL** from Step 1.
   - `FLASK_ENV`: `production`
   - `SECRET_KEY`: Generate a long random string (e.g. `openssl rand -hex 32`).
   - `CORS_ORIGINS`: `https://<your-frontend-subdomain>.onrender.com` (Add your frontend URL once created; comma-separate multiple origins if needed).
   - `PORT`: `10000` (Render sets this automatically).
5. Under **Advanced Settings**, set:
   - **Health Check Path:** `/health`
6. Click **Create Web Service**.
7. Once deployed, note down your backend URL: `https://swamidatt-footwear-api.onrender.com`.

---

#### Step 3: Deploy Frontend Static Site
1. In the Render Dashboard, click **New +** -> **Static Site**.
2. Select your GitHub repository (`shridatt33/ajay-footwear-softwear`).
3. Set the following configuration:
   - **Name:** `swamidatt-footwear-web`
   - **Branch:** `main`
   - **Root Directory:** `frontend`
   - **Build Command:**
     ```bash
     npm install && npm run build
     ```
   - **Publish Directory:** `dist`
4. Add the following **Environment Variables**:
   - `VITE_API_BASE_URL`: `https://swamidatt-footwear-api.onrender.com/api` (Point this to your deployed backend URL).
5. In **Redirects / Rewrites** tab, add a Single Page App (SPA) rewrite rule:
   - **Type:** `Rewrite`
   - **Source:** `/*`
   - **Destination:** `/index.html`
6. Click **Create Static Site**.
7. Copy the generated frontend URL (e.g. `https://swamidatt-footwear-web.onrender.com`).
8. Return to the Backend Web Service (**Step 2**) and update `CORS_ORIGINS` to match this frontend URL.

---

#### Step 4: Create Initial Developer Super Admin
After the backend service is deployed and connected to the PostgreSQL database:
1. Open the **Shell** tab of your deployed Backend Web Service in Render.
2. Run:
   ```bash
   cd backend && python create_dev_admin.py
   ```
3. This creates or verifies the `developer_super_admin` role and master developer account without manual SQL injection.
4. Access the Developer Super Admin Portal at:
   `https://<your-frontend-subdomain>.onrender.com/#/developer-access`

---

## 3. Environment Variables Reference

### Backend Web Service (`backend/`)
| Variable | Required | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | Full PostgreSQL connection URI | `postgresql://user:pass@host:5432/dbname` |
| `PORT` | **Yes** | Port for Gunicorn/Flask to listen on | `10000` (Render default) |
| `FLASK_ENV` | Optional | Set application environment mode | `production` (or `development`) |
| `SECRET_KEY` | Recommended | Flask session cookie signing secret | `<strong-random-hex-string>` |
| `CORS_ORIGINS` | Recommended | Allowed frontend origins (comma-separated) | `https://swamidatt-footwear-web.onrender.com` |
| `FRONTEND_URL` | Optional | Alternate single frontend origin | `https://swamidatt-footwear-web.onrender.com` |

> *Local Development Fallback:* If `DATABASE_URL` is omitted, the backend falls back to local environment variables: `DB_HOST` (default `localhost`), `DB_PORT` (`5432`), `DB_NAME` (`ajay_footwear`), `DB_USER` (`postgres`), and `DB_PASSWORD`.

---

### Frontend Static Site (`frontend/`)
| Variable | Required | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | **Yes** in Prod | Base URL of Flask API including `/api` suffix | `https://swamidatt-footwear-api.onrender.com/api` |

> *Local Development Fallback:* If `VITE_API_BASE_URL` is omitted during local development, frontend defaults to `http://127.0.0.1:5000/api`.

---

## 4. Business Invoices & Ephemeral Storage Architecture

Render web services use an ephemeral file system: files saved to local disk are discarded when a dyno restarts or redeploys.
To prevent permanent loss of sales invoices:
1. When an invoice is finalized via `/api/bills/<id>/save-pdf`, the base64-encoded PDF payload is permanently stored in PostgreSQL in the `bills.pdf_data` column.
2. The `/api/bills/<id>/pdf` download endpoint first checks local disk cache; if not found (e.g. after a dyno restart), it automatically reconstructs the PDF from the database `bills.pdf_data` column and streams it directly to the user as a PDF attachment.
3. This guarantees 100% invoice preservation across restarts and cloud redeployments.

---

## 5. Electron Desktop Application Continuity

The desktop application remains 100% operational alongside web deployment.
- **Local Development:** Running `npm run electron` continues to connect to `http://127.0.0.1:5000` and `http://127.0.0.1:5173`.
- **Packaging Windows Installer:**
  ```bash
  npm run dist
  ```
  This builds the frontend bundle with relative asset paths (`base: './'`) and packages the Windows 64-bit NSIS installer in `dist-electron/` with custom icons and complete offline capabilities.
- **Connecting Desktop to Deployed Backend:**
  If desired, you can configure the desktop client to point directly to your deployed Render backend by setting `VITE_API_BASE_URL` before running `npm run dist`.

---

## 6. Pre-flight Verification Checklist

Before opening the system for shop operations:
- [ ] **Health Check:** `curl https://<backend>/health` returns HTTP 200 with `status: ok` and `database_connection: connected`.
- [ ] **Shop Login:** `/#/login` authenticates valid shop staff and displays dashboard.
- [ ] **Developer Portal:** `/#/developer-access` allows Developer Super Admin management of accounts and backups.
- [ ] **Products & Sizes:** Verify categories, sizes, and stock reflect correctly from PostgreSQL.
- [ ] **POS Billing:**
  - Barcode scanning & multi-size selection adds items to cart.
  - Wholesale billing price editing updates totals dynamically.
  - Customer selection and customer balance calculation works.
  - Bill finalization generates invoice and persists PDF into PostgreSQL.
  - PDF reprint works from `/bills` page.
