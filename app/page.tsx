# ================================
# File: app/page.tsx
# ================================
export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Welcome</h1>
      <p>Go to <a className="text-blue-600 underline" href="/dashboard">Dashboard</a> to begin.</p>
    </div>
  );
}
