# ================================
# File: app/signout/route.ts
# ================================
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/src/lib/supabaseClient";

export async function POST() {
  const supabase = createSupabaseServer();
  await supabase.auth.signOut(); /* clears cookies */
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return NextResponse.redirect(new URL("/signin", site));
}
