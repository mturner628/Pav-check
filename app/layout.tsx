# ================================
# File: app/layout.tsx
# ================================
import "./globals.css";
import Link from "next/link";
import { createSupabaseServer } from "@/src/lib/supabaseClient";

export const metadata = { title: "Hospital Equipment Verification", description: "Room-by-room verification" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b bg-white">
          <nav className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold">🏥 Equipment Verify</Link>
            <div className="flex items-center gap-3">
              <Link className="text-sm hover:underline" href="/dashboard">Dashboard</Link>
              <Link className="text-sm hover:underline" href="/admin/import">Import</Link>
              <Link className="text-sm hover:underline" href="/export">Export</Link>
              {user ? (
                <form action="/signout" method="post">
                  <button className="rounded bg-gray-100 px-3 py-1 text-sm">Sign out</button>
                </form>
              ) : (
                <Link href="/signin" className="rounded bg-black text-white px-3 py-1 text-sm">Sign in</Link>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
