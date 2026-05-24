import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = import.meta.env.VITE_SUPABASE_URL         ?? '';
const SUPABASE_ANON_KEY    = import.meta.env.VITE_SUPABASE_ANON_KEY    ?? '';
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY ?? '';

// ── Startup validation ────────────────────────────────────────────────────────
const missing = [];
if (!SUPABASE_URL)         missing.push('VITE_SUPABASE_URL');
if (!SUPABASE_ANON_KEY)    missing.push('VITE_SUPABASE_ANON_KEY');
if (!SUPABASE_SERVICE_KEY) missing.push('VITE_SUPABASE_SERVICE_KEY');

if (missing.length > 0) {
  // Show a hard visible error in the browser — no more silent empty tables
  const msg =
    `[Tournvia Admin] Missing required env variables:\n  ${missing.join('\n  ')}\n\n` +
    `Create a .env file in the project root.\nSee .env.example for the required keys.`;

  // eslint-disable-next-line no-console
  console.error(msg);

  // Inject a blocking banner so it's impossible to miss during dev
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const banner = document.createElement('div');
      banner.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:99999',
        'background:#0f0a0a', 'color:#f87171',
        'font-family:monospace', 'font-size:14px',
        'display:flex', 'flex-direction:column',
        'align-items:center', 'justify-content:center',
        'padding:2rem', 'text-align:center', 'gap:1rem',
      ].join(';');
      banner.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
          stroke="#f87171" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <strong style="font-size:16px;color:#fca5a5">Admin panel cannot start</strong>
        <p style="color:#9ca3af;max-width:480px">
          Missing environment variable${missing.length > 1 ? 's' : ''}:
        </p>
        <code style="background:#1c1917;padding:0.75rem 1.5rem;border-radius:8px;
          border:1px solid #3f3f46;color:#fdba74;line-height:2">
          ${missing.join('<br/>')}
        </code>
        <p style="color:#6b7280;max-width:480px;font-size:12px">
          Create a <strong style="color:#9ca3af">.env</strong> file in the project root.<br/>
          Copy <strong style="color:#9ca3af">.env.example</strong> and fill in your Supabase keys.<br/>
          The Service Role key is in: Supabase Dashboard → Project Settings → API.
        </p>
      `;
      document.body.prepend(banner);
    });
  }
}

// ── Auth client — anon key, persists session (login/logout only) ──────────────
export const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession:   true,
    storageKey:       'tournvia-admin-auth',
  },
});

// ── Admin data client — service role key, bypasses RLS entirely ───────────────
// ⚠️  NEVER use this key in the public-facing (tournament) app.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession:   false,
  },
});
