import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/people.css';

interface Props { notStaffEmail?: string; onSignOut?: () => void }

type Errors = { email?: string; password?: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Title: React.FC<{ long?: boolean }> = ({ long }) => (
  <div className="lg-title"><h1>Shiv Shakti</h1><p>Catering and sweets · sign in{long ? ' to continue' : ''}</p></div>
);

// Staff sign-in with errors under the fields; also the "check your email" and "not on the team" cards.
const LoginScreen: React.FC<Props> = ({ notStaffEmail, onSignOut }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [sentTo, setSentTo] = useState('');

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Errors = {};
    if (!EMAIL_RE.test(email.trim())) found.email = 'Type the email you sign in with';
    if (!password) found.password = 'Type your password';
    setErrors(found);
    if (found.email || found.password) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErrors({ password: /invalid login/i.test(error.message) ? 'Email or password is wrong. Check Caps Lock and try again.' : error.message });
  };

  const forgot = async () => {
    if (!EMAIL_RE.test(email.trim())) { setErrors({ email: 'Type your email first, then tap "Forgot password?"' }); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    if (error) setErrors({ email: error.message });
    else setSentTo(email.trim());
  };

  if (notStaffEmail) {
    return (
      <div className="lg-wrap">
        <div className="lg-card center" role="alert">
          <h1>You're signed in, but not on the team yet</h1>
          <p><b>{notStaffEmail}</b> can't see the shop's data. Ask the owner to add this email to the staff list in Supabase.</p>
          <div className="lg-pair">
            <button type="button" className="ui-btn" onClick={onSignOut}>Sign out</button>
            <button type="button" className="ui-btn primary" onClick={() => window.location.reload()}>Check again</button>
          </div>
        </div>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="lg-wrap">
        <div className="lg-card center" role="status">
          <h1>Check your email</h1>
          <p>We sent a link to {sentTo}. Open it on this device to set a new password. Nothing there? Check spam, or send it again in a minute.</p>
          <button type="button" className="ui-btn" onClick={() => setSentTo('')}>Back to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lg-wrap">
      <form className="lg-form" onSubmit={signIn} noValidate>
        <Title />
        <div className="lg-card">
          <span className="lg-mark" aria-hidden="true">SS</span>
          <Title long />
          <label className="lg-field">Email
            <span className={`lg-input${errors.email ? ' bad' : ''}`}>
              <input type="email" autoComplete="username" autoFocus value={email} aria-invalid={!!errors.email}
                onChange={e => { setEmail(e.target.value); setErrors({}); }} />
            </span>
            {errors.email && <span className="lg-err">{errors.email}</span>}
          </label>
          <label className="lg-field">Password
            <span className={`lg-input${errors.password ? ' bad' : ''}`}>
              <input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} aria-invalid={!!errors.password}
                onChange={e => { setPassword(e.target.value); setErrors({}); }} />
              <button type="button" className="lg-show" aria-pressed={show} onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button>
            </span>
            {errors.password && <span className="lg-err" role="alert">{errors.password}</span>}
          </label>
          <div className="lg-bar"><button type="submit" className="ui-btn primary lg-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></div>
          <button type="button" className="lg-forgot" onClick={forgot} disabled={busy}>Forgot password?</button>
        </div>
        <button type="button" className="lg-forgot-row" onClick={forgot} disabled={busy}>
          <span><b>Forgot password?</b><span>We email you a reset link</span></span><span aria-hidden="true">›</span>
        </button>
      </form>
    </div>
  );
};

export default LoginScreen;
