import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars missing. Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_SUPABASE_SERVICE_KEY in .env');
}

// ✅ Used ONLY for admin login/logout/session — anon key, persists session
export const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storageKey: 'tournvia-admin-auth',
  },
});

// ✅ Used for ALL data queries — service role key, bypasses RLS entirely
// ⚠️ NEVER expose this key in the public-facing (tournament) app.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
