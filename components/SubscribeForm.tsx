'use client';

import { useState } from 'react';

type State = { status: 'idle' | 'loading' | 'ok' | 'error'; message?: string };

type Labels = { placeholder: string; button: string; busy: string };

export function SubscribeForm({ labels }: { labels: Labels }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState({ status: 'loading' });

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok) {
        setState({ status: 'error', message: data.error ?? 'Something went wrong.' });
        return;
      }
      setEmail('');
      setState({ status: 'ok', message: data.message ?? 'Subscribed.' });
    } catch {
      setState({ status: 'error', message: 'Network error — please try again.' });
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md">
      <div className="flex gap-2">
        <label htmlFor="subscribe-email" className="sr-only">
          Email address
        </label>
        <input
          id="subscribe-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={labels.placeholder}
          className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 placeholder:text-mist-400 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={state.status === 'loading'}
          className="shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink-950 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {state.status === 'loading' ? labels.busy : labels.button}
        </button>
      </div>
      {state.message && (
        <p
          className={`mt-2.5 text-sm ${state.status === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}
          role="status"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
