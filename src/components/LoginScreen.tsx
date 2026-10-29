import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props { notStaffEmail?: string; onSignOut?: () => void }

// Staff sign-in; also shown when a signed-in email isn't on the staff list.
const LoginScreen: React.FC<Props> = ({ notStaffEmail, onSignOut }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg({ text: error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message });
  };

  const reset = async () => {
    if (!email.trim()) { setMsg({ text: 'Type your email first, then tap "Forgot password".' }); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setMsg(error ? { text: error.message } : { text: 'Password reset email sent.', ok: true });
  };

  return (
    <div style={wrap}>
      <div style={box}>
        <img src="/logo.png" alt="Shiv Shakti" style={{ height: 64, display: 'block', margin: '0 auto 12px' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        {notStaffEmail ? (
          <>
            <div style={title}>Access not set up</div>
            <p style={p}><b>{notStaffEmail}</b> is signed in but isn't on the staff list. Ask the owner to add this email in Supabase (table <code>staff</code>).</p>
            <button style={btn} onClick={onSignOut}>Sign out</button>
          </>
        ) : (
          <form onSubmit={signIn}>
            <div style={title}>Sign in</div>
            <label style={lbl}>Email</label>
            <input style={inp} type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <label style={lbl}>Password</label>
            <input style={inp} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
            {msg && <div style={{ fontSize: 12, margin: '4px 0 10px', color: msg.ok ? '#3B6D11' : '#A32D2D' }}>{msg.text}</div>}
            <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" onClick={reset} style={link}>Forgot password?</button>
          </form>
        )}
      </div>
    </div>
  );
};

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F0', padding: 16 };
const box: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 14, padding: 24, width: '100%', maxWidth: 360, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' };
const title: React.CSSProperties = { fontSize: 17, fontWeight: 700, textAlign: 'center', marginBottom: 16 };
const p: React.CSSProperties = { fontSize: 13, color: '#555', lineHeight: 1.5, marginBottom: 16, textAlign: 'center' };
const lbl: React.CSSProperties = { fontSize: 12, color: '#888880', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D0D0CC', fontSize: 14, marginBottom: 12 };
const btn: React.CSSProperties = { width: '100%', height: 44, background: '#E8750A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' };
const link: React.CSSProperties = { display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: '#378ADD', fontSize: 12, cursor: 'pointer' };

export default LoginScreen;
