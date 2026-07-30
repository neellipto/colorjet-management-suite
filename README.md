# COLORJET ERP Mobile

Production-oriented starter for COLORJET Bangladesh ERP Mobile App.

**Business:** COLORJET Bangladesh  
**Slogan:** Quality • Commitment • Service  
**Scope:** Owner Dashboard, Office Task, Engineer Service, Warranty, Stock, Customers, and Odoo report sync.

## Repository Structure

```text
colorjet-erp-mobile/
├─ mobile/    # Expo React Native Android-first app
├─ backend/   # Node.js API proxy for Odoo/Firebase-safe server logic
└─ docs/      # Setup and deployment notes
```

## Important Security Rule

Do not commit real credentials to GitHub.
Use `.env` locally/server-side only.

Never commit:

```text
.env
.env.local
firebase service account json
Odoo API key
Database password
Keystore password
node_modules
build/dist output
```

## Quick Start

### 1) Mobile app

```bash
cd mobile
npm install
cp .env.example .env
npm start
```

### 2) Backend API

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Health check:

```bash
curl http://localhost:8080/api/v1/health
```

## GitHub Push

```bash
git init
git branch -M main
git add .
git commit -m "Initial COLORJET ERP Mobile starter"
git remote add origin https://github.com/itechbdaa-byte/colorjet-erp-mobile.git
git push -u origin main
```

## Next Production Steps

1. Add original COLORJET logo only; do not redesign or recolor it.
2. Configure Firebase Authentication.
3. Deploy backend API to your server/subdomain.
4. Add Odoo credentials only on backend `.env`.
5. Connect mobile `.env` with backend public API URL.
6. Build APK/AAB through EAS Build.

