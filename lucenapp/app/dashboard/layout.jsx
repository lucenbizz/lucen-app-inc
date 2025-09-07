// app/dashboard/layout.jsx
export const metadata = { title: "Dashboard — Lucen" };

export default function DashboardLayout({ children }) {
  return <section className="container-safe py-6">{children}</section>;
}
