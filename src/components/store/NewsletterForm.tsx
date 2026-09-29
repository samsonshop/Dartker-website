'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function NewsletterForm() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Something went wrong.');
      toast({ title: 'You’re on the list', description: data.message, tone: 'success' });
      setEmail('');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Your email address"
          autoComplete="email"
          aria-invalid={error ? true : undefined}
          className="h-11 flex-1 rounded-xl border border-taupe-200 bg-white px-3.5 text-sm text-charcoal-700 placeholder:text-charcoal-300 focus:border-wine-400"
        />
        <Button type="submit" loading={loading} className="sm:w-auto">
          Subscribe
        </Button>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-danger-600" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
