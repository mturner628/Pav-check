# ================================
# File: app/floors/[id]/page.tsx
# ================================
import Link from "next/link";
import { createSupabaseServer } from "@/src/lib/supabaseClient";

export default async function FloorPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServer();

  const [{ data: floor }, { data: rooms }, { data: prog }, { data: cnt }] = await Promise.all([
    supabase.from("floors").select("id,name").eq("id", params.id).single(),
    supabase.from("rooms").select("*").eq("floor_id", params.id).order("name"),
    supabase.from("v_floor_progress").select("*").eq("floor_id", params.id).maybeSingle(),
    supabase.from("v_floor_flag_counts").select("*").eq("floor_id", params.id).maybeSingle()
  ]);

  const total_expected = prog?.total_expected ?? 0;
  const total_ok = prog?.total_ok ?? 0;
  const pct = total_expected > 0 ? Math.round((total_ok / total_expected) * 100) : 0;
  const openFlags = cnt?.open_flags ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{floor?.name}</h1>
        <div className="flex items-center gap-3">
          <div className="w-40">
            <div className="h-2 w-full rounded bg-gray-200">
              <div className="h-2 rounded bg-black" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs text-gray-600 mt-1">{pct}% complete</div>
          </div>
          <Link href={`/floors/${params.id}/followups`} className="rounded bg-black text-white px-3 py-1 text-sm">
            View Follow-Ups {openFlags > 0 ? `(${openFlags})` : ""}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(rooms ?? []).map((r) => (
          <Link key={r.id} href={`/rooms/${r.id}`} className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-gray-500">{r.type ?? "Room"}</div>
              </div>
              <span className="text-xs rounded px-2 py-1 bg-gray-100">{r.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
