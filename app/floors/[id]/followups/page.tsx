# ================================
# File: app/floors/[id]/followups/page.tsx
# ================================
import { createSupabaseServer } from "@/src/lib/supabaseClient";
import FollowupsClient from "./FollowupsClient";
import { FLAG_TYPES, SEVERITIES } from "@/src/lib/constants";

export default async function FollowupsPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServer();
  const [{ data: floor }, { data: users }] = await Promise.all([
    supabase.from("floors").select("id,name").eq("id", params.id).single(),
    supabase.from("profiles").select("id,email,role").order("email")
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Follow-Ups — {floor?.name}</h1>
      <FollowupsClient
        floorId={params.id}
        users={(users ?? []).map((u) => ({ id: u.id, email: u.email, role: u.role }))}
        flagTypes={FLAG_TYPES as unknown as string[]}
        severities={SEVERITIES as unknown as string[]}
      />
    </div>
  );
}
