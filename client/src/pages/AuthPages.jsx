import React, { useState } from 'react';
import { ShieldCheck, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';

export function FirstTimeSetupPage() {
  const { setupAdmin } = useAuth();
  const [form, setForm] = useState({
    companyName: '',
    fullName: '',
    username: '',
    email: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await setupAdmin(form);
    } catch (err) {
      setError(getErrorMessage(err, 'Setup failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <ShieldCheck size={28} color="#1e3a5f" aria-hidden="true" />
          <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#1e3a5f' }}>
            QMS Initial Admin Setup
          </h1>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          This clean database has no user accounts yet. Create the primary System Administrator to begin.
        </p>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="setup-company">Company / Factory Name</label>
            <input
              id="setup-company"
              name="companyName"
              type="text"
              placeholder="e.g. Apex Apparels Ltd."
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="setup-fullname">Administrator Full Name *</label>
            <input
              id="setup-fullname"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="setup-username">Username *</label>
            <input
              id="setup-username"
              name="username"
              type="text"
              required
              minLength={3}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="setup-email">Email</label>
            <input
              id="setup-email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="setup-password">Password * (minimum 8 characters)</label>
            <input
              id="setup-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={submitting}
          >
            {submitting ? 'Creating Administrator...' : 'Complete Initial Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login, company } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(identifier, password);
    } catch (err) {
      setError(getErrorMessage(err, 'Sign in failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <LogIn size={26} color="#1e3a5f" aria-hidden="true" />
          <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#1e3a5f' }}>
            {company?.companyName || 'Garment Quality Management'}
          </h1>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Sign in with your assigned Quality Management credentials.
        </p>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-identifier">Username or Email *</label>
            <input
              id="login-identifier"
              name="identifier"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password *</label>
            <input
              id="login-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={submitting}
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
