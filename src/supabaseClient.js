import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';

// Admin dashboard uses the service_role key — this bypasses RLS entirely.
// ⚠️ NEVER expose this key in the public-facing (tournament) app.
// This app must stay password-protected / admin-only.
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY in .env');
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    // service_role clients should not persist sessions
    autoRefreshToken: false,
    persistSession: false,
    storageKey: 'tournvia-admin-auth',
  },
});
