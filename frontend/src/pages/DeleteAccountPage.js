import React, { useState } from 'react';
import { api } from '../lib/api';
import { Trash2, CheckCircle2, ShieldAlert } from 'lucide-react';

/**
 * Public account & data deletion request page (required by Google Play / App Store).
 * Anyone can submit a request without logging in; it lands in the admin contact inbox.
 */
const CONTACT_EMAIL = 'contact@openmarketlb.com';

const DeleteAccountPage = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email) { setError('Please enter the email address on your account.'); return; }
    setBusy(true); setError('');
    try {
      await api.contact.send({
        name: form.name || 'Account deletion request',
        email: form.email,
        phone_number: form.phone,
        message_type: 'general',
        message:
          `ACCOUNT DELETION REQUEST\n` +
          `Account email: ${form.email}\n` +
          `Phone: ${form.phone || '—'}\n` +
          `Reason: ${form.reason || '—'}\n\n` +
          `The user has requested deletion of their account and associated data.`,
      });
      setSent(true);
    } catch (err) {
      setError('Something went wrong. Please email us directly at ' + CONTACT_EMAIL + '.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen py-8 sm:py-12" data-testid="delete-account-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Delete Your Account</h1>
        </div>
        <p className="text-slate-500 mb-8">
          Request permanent deletion of your OpenMarketlb account and associated personal data.
        </p>

        {sent ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900">Request received</h2>
            <p className="text-slate-600 mt-2 leading-relaxed">
              We've received your account deletion request. Our team will verify it and permanently
              delete your account and associated data within <strong>30 days</strong>. We'll email
              you at <strong>{form.email}</strong> once it's done.
            </p>
          </div>
        ) : (
          <>
            {/* What happens */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-3">What gets deleted</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
                <li>Your profile (name, email, phone, password).</li>
                <li>Saved addresses, wishlist, and cart.</li>
                <li>Your messages and support conversations.</li>
                <li>Any shop application tied to your account.</li>
              </ul>
              <div className="flex gap-3 mt-5 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  <strong>Please note:</strong> some order and transaction records may be retained in
                  an anonymized form where required for legal, tax, or accounting purposes. Deletion
                  is permanent and cannot be undone.
                </p>
              </div>
            </div>

            {/* Request form */}
            <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Request deletion</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Your name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Account email <span className="text-rose-500">*</span></label>
                <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone number</label>
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+961 …"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason (optional)</label>
                <textarea value={form.reason} onChange={(e) => set('reason', e.target.value)} rows={3} placeholder="Anything you'd like us to know"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <button type="submit" disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold py-3 hover:opacity-95 disabled:opacity-60 transition">
                {busy ? 'Submitting…' : 'Request account deletion'}
              </button>
              <p className="text-xs text-slate-400 text-center">
                Prefer email? Write to <a href={`mailto:${CONTACT_EMAIL}?subject=Account%20deletion%20request`} className="text-violet-700 underline">{CONTACT_EMAIL}</a>.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default DeleteAccountPage;
