# Deploy

## Frontend

1. Create a production build with `npm run build` inside `frontend`.
2. Deploy the build folder to Vercel, Netlify, or another static host.
3. Set `REACT_APP_API_BASE_URL` to the public URL of the backend.

## Backend

1. Deploy `backend/server.js` to Render, Railway, Fly.io, or a VPS.
2. Set `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, and `PORT` in the host environment.
3. Set `FRONTEND_URL` to the public frontend URL, or use `FRONTEND_URLS` for multiple comma-separated origins.

## Notes

The frontend now reads the backend URL from an environment variable, and the backend CORS policy is also environment-driven. That makes it possible to keep the original site and this fork online side by side without changing code again.