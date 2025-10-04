# ================================
# File: app/dashboard/page.tsx
# ================================
import Link from "next/link";
import { createSupabaseServer } from "@/src/lib/supabaseClient";

type Floor = { id: string; name: string; sort_index: number };

export default async function Dashboard() {
  const supabase = createSupabaseServer();

  const [{ data: floors }, { data: prog }, { data: counts }] = await Promise.all([
    supabase.from("floors").select("id,name,sort_index").order("sort_index", { ascending: true }),
    supabase.from("v_floor_progress").select("*"),
    supabase.from("v_floor_flag_counts").select("*")
  ]);

  const progById = new Map((prog ?? []).map((p: any) => [p.floor_id, p]));
  const cntById = new Map((counts ?? []).map((c: any) => [c.floor_id, c.open_flags as number]));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Building Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(floors ?? []).map((f: Floor) => {
          const p = progById.get(f.id) ?? { total_expected: 0, total_ok: 0 };
          const pct = p.total_expected > 0 ? Math.round((p.total_ok / p.total_expected) * 100) : 0;
          const open = cntById.get(f.id) ?? 0;
          return (
            <Link key={f.id} href={`/floors/${f.id}`} className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="w-40 mt-2">
                    <div className="h-2 w-full rounded bg-gray-200">
                      <div className="h-2 rounded bg-black" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{pct}% complete</div>
                  </div>
                </div>
                {open > 0 && (
                  <span className="text-xs rounded-full bg-red-100 px-2 py-1">⚠️ {open} open</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
