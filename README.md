# Tournvia Master Panel

Standalone admin panel for the Tournvia Free Fire esports platform.

- React + Vite + TailwindCSS
- Supabase client reuses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Admin auth stored with storage key `tournvia-admin-auth`

## Getting started

1. Extract this folder.
2. Create a `.env` file next to `package.json`:

```ini
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Install dependencies and run dev server:

```bash
npm install
npm run dev
```

4. Login with any existing Supabase admin email/password account.
