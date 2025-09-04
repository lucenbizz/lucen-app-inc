// app/plans/page.jsx
import CheckoutButton from "./CheckoutButton";

export const metadata = {
  title: "Plans — Lucen",
  description: "Choose a plan that fits your journey. Bronze, Silver, Gold, and Black.",
};

const PLANS = [
  {
    key: "bronze",
    name: "Bronze",
    price: 50,
    description: "Start strong with the essentials.",
    perks: ["1 ebook"],
    cta: "Choose Bronze",
    highlight: false,
  },
  {
    key: "silver",
    name: "Silver",
    price: 75,
    description: "Level up your momentum.",
    perks: ["2 ebooks"],
    cta: "Choose Silver",
    highlight: false,
  },
  {
    key: "gold",
    name: "Gold",
    price: 125,
    description: "Our most popular choice.",
    perks: ["4 ebooks"],
    badge: "Most Popular",
    cta: "Choose Gold",
    highlight: true, // subtle glow
  },
  {
    key: "black",
    name: "Black",
    price: 475, // updated
    description: "Exclusive perks and recognition.",
    perks: ["All ebooks", "VIP badge"],
    badge: "Elite",
    cta: "Choose Black",
    highlight: true,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Gold hit the sweet spot—I finished four books in a month and actually stuck to the plan.",
    author: "Taylor R.",
    role: "Product Designer",
  },
  {
    quote:
      "Upgraded to Black. The VIP badge is a small thing—but it motivates me daily.",
    author: "Avery S.",
    role: "Investor",
  },
  {
    quote:
      "Everything feels premium, from the content to the delivery experience.",
    author: "Jordan M.",
    role: "Founder",
  },
];

const FAQ = [
  {
    q: "Can I upgrade later?",
    a: "Yes. You can upgrade anytime—your new benefits apply immediately. (Billing details depend on your payment platform.)",
  },
  {
    q: "What does “all ebooks” include?",
    a: "Access to all current titles and any future releases included in your plan window.",
  },
  {
    q: "How does checkout work?",
    a: "You’ll be redirected to a secure Stripe checkout. On success, your plan and perks are applied automatically.",
  },
];

export default function PlansPage() {
  return (
    <main className="container-safe py-10 space-y-14">
      {/* Hero */}
      <section className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold gold-text">Choose your plan</h1>
        <p className="text-[#cfcfcf] max-w-2xl mx-auto">
          Simple tiers that scale with your ambition. Switch plans anytime.
        </p>
      </section>

      {/* Plans grid */}
      <section className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
        {PLANS.map((p) => (
          <article
            key={p.key}
            className={`card p-5 flex flex-col justify-between ${p.highlight ? "gold-glow gold-border" : ""}`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold gold-text">{p.name}</h3>
                {p.badge && <span className="badge gold">{p.badge}</span>}
              </div>

              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold">${p.price}</span>
                <span className="text-sm text-[#bdbdbd]">/ one-time</span>
              </div>

              <p className="text-[#cfcfcf]">{p.description}</p>

              <ul className="mt-3 space-y-2 text-sm">
                {p.perks.map((perk, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1 inline-block h-2 w-2 rounded-full"
                      style={{ background: "linear-gradient(92deg, var(--gold-400), var(--gold-600))" }}
                    />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-5">
              <CheckoutButton
                plan={p.key}
                className={`w-full btn ${p.highlight ? "btn-primary" : "btn-outline"} block text-center`}
              >
                {p.cta}
              </CheckoutButton>
            </div>
          </article>
        ))}
      </section>

      {/* Testimonials */}
      <section className="grid md:grid-cols-3 gap-4">
        {TESTIMONIALS.map((t, i) => (
          <figure key={i} className="card p-5 gold-border">
            <blockquote className="italic text-[#e9e9e9]">“{t.quote}”</blockquote>
            <figcaption className="mt-3 text-sm text-[#bdbdbd]">
              <span className="font-semibold text-white">{t.author}</span> — {t.role}
            </figcaption>
          </figure>
        ))}
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold gold-text">FAQs</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {FAQ.map((item, i) => (
            <div key={i} className="card p-5">
              <h3 className="font-semibold mb-2">{item.q}</h3>
              <p className="text-[#cfcfcf] text-sm">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
