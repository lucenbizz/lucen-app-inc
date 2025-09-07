// app/success/page.jsx
export const metadata = { title: "Success — Lucen" };
export default function Page() {
  return (
    <main className="container-safe py-10">
      <h1 className="text-2xl font-bold">Payment successful</h1>
      <p className="text-[#cfcfcf] mt-2">Thanks! Your perks are now active.</p>
    </main>
  );
}
