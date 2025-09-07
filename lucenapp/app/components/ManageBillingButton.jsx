'use client';

export default function ManageBillingButton({ className = 'btn btn-outline', children = 'Manage billing' }) {
  const onClick = async () => {
    try {
      const r = await fetch('/api/billing/portal', { method: 'POST' });
      if (r.status === 401) {
        window.location.href = '/auth/sign-in?next=/dashboard';
        return;
      }
      const { url, error } = await r.json();
      if (error || !url) throw new Error(error || 'No portal URL');
      window.location.href = url;
    } catch (e) {
      alert('Could not open the billing portal. Please try again.');
      console.error(e);
    }
  };

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
