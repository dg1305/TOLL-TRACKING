# 3i Sales Funnel

Sales pipeline app for 3i Medical Technologies (MRI, FPD, Gamma Camera).

## Architecture

- `server/` — Express + TypeScript + MySQL (`3i_Sales_funnel`) + JWT
- `client/` — React 18 + Vite. Production build: `client/out`
- `SERVE_CLIENT=true` — one process on **port 4090** serves the UI and `/api/v1`

## Environment

Copy the example env files, then fill in local values. Do not commit `.env`.

```bash
copy server\.env.example server\.env
copy client\.env.example client\.env
```

- `server/.env.example` — database, JWT, port, and optional SMTP
- `client/.env.example` — Vite API port / URL (needed only for `npm run dev`)

## Database

```bash
cd server
npm install
npm run migrate
npm run seed
```

## Run

```bash
cd client
npm install
npm run build

cd ../server
npm start
```

Open **http://127.0.0.1:4090/** and sign in.

## FASTag lookups

Signed-in users open **FASTag** in the sidebar.

1. Upload an Excel or CSV sheet (`.xlsx`, `.xls`, or `.csv`) that contains vehicle numbers such as `CG13BF6032`. This can be done two or three times a day.
2. Click **Fetch toll data**. Each pull is appended to `server/data/fastag.json` with the date and time. Earlier pulls stay in the file.
3. **Re-run failed** retries only the rows that failed, and those new results are appended too.
4. **Export Excel** downloads `fastag-responses-YYYY-MM-DD_HH-mm-ss.xlsx`.
5. Sign-in accounts live in `server/data/users.json`. The activity log lives in `server/data/activity.json`. FASTag does not need the database.

Set `FASTAG_ACCESS_TOKEN` in `server/.env`. The browser never receives that token.

## Local Vite (optional)

Terminal 1: `cd server && npm run dev`  
Terminal 2: `cd client && npm run dev`  

Vite: http://127.0.0.1:5173/ (proxies `/api` to 4090).
