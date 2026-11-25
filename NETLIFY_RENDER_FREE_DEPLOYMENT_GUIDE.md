# ZhanX DentalCare & Tamilan SaaS: Live Cloud Deployment Guide

This guide explains how to deploy the entire multi-tenant system for **100% FREE** with high availability:
- **Frontend (Web App)**: Hosted on **Netlify**
- **Backend (API Server)**: Hosted on **Render**
- **Database (PostgreSQL)**: Hosted on **Neon.tech** (Recommended free serverless Postgres) or **Render Free Postgres**

---

## 1. Free Cloud PostgreSQL Database (Zero Cost)

### Recommended: Neon.tech (Best 100% Free Forever Postgres)
1. Go to **[https://neon.tech](https://neon.tech)** and click **Sign Up** (Sign in with GitHub or Google).
2. Click **Create Project**:
   - **Project Name**: `zhanx-dentalcare-db`
   - **Postgres Version**: `16`
   - **Region**: Select **Asia Pacific (Singapore)** for lowest latency in India.
3. Once created, copy the **Connection string** (choose **Node.js** or **Direct connection**):
   ```text
   postgresql://neondb_owner:YOUR_PASSWORD@ep-solitary-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. That's it! This single URL is your `DATABASE_URL`. Neon provides 0.5 GB free storage, which holds 10 to 20 clinics for 2+ years.

---

## 2. Backend Deployment on Render (Web Service)

The project includes `render.yaml` for 1-click deployment.

### Option A: Via GitHub (Recommended)
1. Push this repository to your **GitHub** (Private repository).
2. Go to **[https://dashboard.render.com](https://dashboard.render.com)**.
3. Click **New +** -> **Web Service**.
4. Select your GitHub repository.
5. Fill in the following settings:
   - **Name**: `zhanx-dentalcare-server`
   - **Region**: `Singapore`
   - **Branch**: `main`
   - **Root Directory**: `apps/server` (or leave empty if using root)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node apps/server/src/database/migrate.js && node apps/server/src/server.js`
   - **Plan**: `Free`
6. Click **Advanced** -> **Add Environment Variable**:
   | Key | Value | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Production mode |
   | `PORT` | `4000` | Port |
   | `JWT_SECRET` | `zhanx_super_secure_production_jwt_secret_key_2026_tamilan_saas` | Min 32 chars |
   | `DATABASE_URL` | *Paste your Neon or Render DB URL* | Connection string |
   | `CORS_ORIGINS` | `*` | Allows Netlify to connect |
7. Click **Create Web Service**.
8. Render will install dependencies, run database migrations automatically, and start the API!
9. Note down your backend URL (e.g. `https://zhanx-dentalcare-server.onrender.com`).

---

## 3. Frontend Deployment on Netlify

The project includes `netlify.toml` in the repository root.

### Method 1: Git Integration (Auto Deploys on Git Push)
1. Go to **[https://app.netlify.com](https://app.netlify.com)**.
2. Click **Add new site** -> **Import an existing project** -> **GitHub**.
3. Select your repository.
4. Netlify will automatically detect settings from [netlify.toml](file:///C:/DHMS/9fd0fe3a/netlify.toml):
   - **Build command**: `npm --workspace apps/desktop run build`
   - **Publish directory**: `apps/desktop/dist`
5. Under **Environment variables**, add:
   - `VITE_API_URL` = `https://your-render-backend-name.onrender.com/api`
6. Click **Deploy Site**.

### Method 2: Instant 30-Second Drag & Drop (No Git Needed)
If you want to test live immediately right now without connecting GitHub:
1. Open terminal and run:
   ```powershell
   cd C:\DHMS\9fd0fe3a
   npm --workspace apps/desktop run build
   ```
2. Open **[https://app.netlify.com/drop](https://app.netlify.com/drop)** in your browser.
3. Drag and drop the folder `C:\DHMS\9fd0fe3a\apps\desktop\dist` into the upload box.
4. Netlify will deploy your site in 10 seconds and give you a live URL like `https://radiant-dental-1234.netlify.app`!

---

## 4. Verifying the Live Deployment

Once both are deployed:
1. Open `https://your-render-backend.onrender.com/healthz`  
   Should return: `{"data":{"status":"ok","database":true}}`
2. Open `https://your-site.netlify.app/tamilan`  
   Enter Master PIN: `7788`  
   The Tamilan SaaS Super Admin dashboard opens with live clinic registration, seat controls, and payment verification!
