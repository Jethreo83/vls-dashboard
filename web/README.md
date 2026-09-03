# VLS Dashboard — Frontend

React + Vite + TypeScript. Google Sign-In restricted to @vlslawfirm.com,
JWT session against the API in ../api.

## Dev

```bash
cp .env.example .env   # fill in VITE_GOOGLE_CLIENT_ID
npm install
npm run dev
```

Requires the API (../api) running on the URL in VITE_API_BASE_URL.
