"use client";

export default function CheckoutButton({ plan, children, className }) {
  const onClick = async () => {
    try {
      const r = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (r.status === 401) {
        window.location.href = `/auth/sign-in?next=/plans&plan=${encodeURIComponent(plan)}`;
        return;
      }
      const { url, error } = await r.json();
      if (error || !url) throw new Error(error || 'No session URL');
      window.location.href = url;
    } catch (e) {
      alert('Checkout failed. Please try again.');
      console.error(e);
    }
  };

  return (
    <button className={className} onClick={onClick} aria-label={`Buy ${plan} plan`}>
      {children}
    </button>
  );
}
