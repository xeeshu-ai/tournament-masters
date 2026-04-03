import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';

export function Login() {
  const navigate = useNavigate();
  const [form, setForm] = React.useState({ email: '', password: '' });
  const [status, setStatus] = React.useState(null); // null | 'loading' | 'error'

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    if (error || !data?.user) {
      // eslint-disable-next-line no-console
      console.error(error);
      setStatus('error');
    } else {
      setStatus(null);
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <div className="mb-4 space-y-1 text-center">
          <p className="text-11px font-semibold uppercase tracking-[0.2em] text-slate-400">
            Tournvia
          </p>
          <h1 className="text-lg font-semibold text-slate-50">Login as admin</h1>
          <p className="text-[11px] text-slate-400">
            Access to this panel is restricted. Admin accounts are created directly in Supabase.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs text-slate-200">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full text-xs" disabled={status === 'loading'}>
            {status === 'loading' ? 'Logging in…' : 'Login as admin'}
          </button>
          {status === 'error' && (
            <p className="text-[11px] text-red-400">Login failed. Check credentials in Supabase Auth.</p>
          )}
        </form>
      </div>
    </div>
  );
}
