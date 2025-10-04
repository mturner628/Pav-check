# ================================
# File: app/floors/[id]/followups/FollowupsClient.tsx
# ================================
"use client";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/src/lib/supabaseClient";

type User = { id: string; email: string; role: string };
type FlagRow = {
  id: string;
  type: string;
  severity: string | null;
  reason: string | null;
  room_name: string;
  assigned_to: string | null;
  assigned_email?: string | null;
  created_at: string;
};

export default function FollowupsClient({
  floorId,
  users,
  flagTypes,
  severities
}: {
  floorId: string;
  users: User[];
  flagTypes: string[];
  severities: string[];
}) {
  const supabase = createSupabaseBrowser();
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [assignUserId, setAssignUserId] = useState<string>("");

  async function loadFlags() {
    const { data } = await supabase
      .from("flags")
      .select(
        `
        id,type,severity,reason,status,created_at,assigned_to,info_only,
        rooms!inner(name,floor_id),
        assignee:profiles!flags_assigned_to_fkey(id,email)
      `
      )
      .eq("status", "open")
      .eq("info_only", false)
      .eq("rooms.floor_id", floorId);

    const mapped: FlagRow[] = (data ?? []).map((f: any) => ({
      id: f.id,
      type: f.type,
      severity: f.severity,
      reason: f.reason,
      room_name: f.rooms?.name ?? "",
      assigned_to: f.assigned_to,
      assigned_email: f.assignee?.email ?? null,
      created_at: f.created_at
    }));
    setRows(mapped);
    setSelected(new Set());
  }

  useEffect(() => {
    loadFlags();
    const ch = supabase
      .channel(`flags-floor-${floorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flags" },
        () => loadFlags()
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [floorId, supabase]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterType && r.type !== filterType) return false;
      if (filterSeverity && (r.severity ?? "") !== filterSeverity) return false;
      return true;
    });
  }, [rows, filterType, filterSeverity]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) filtered.forEach((r) => n.delete(r.id));
      else filtered.forEach((r) => n.add(r.id));
      return n;
    });
  }

  async function bulkAssign() {
    if (!assignUserId || selected.size === 0) return;
    await supabase.from("flags").update({ assigned_to: assignUserId }).in("id", Array.from(selected));
    await loadFlags();
  }

  async function bulkResolve() {
    if (selected.size === 0) return;
    await supabase
      .from("flags")
      .update({ status: "closed", resolved_at: new Date().toISOString() })
      .in("id", Array.from(selected));
    await loadFlags();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-2">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Type</label>
          <select className="rounded border px-2 py-1 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All</option>
            {flagTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Severity</label>
          <select className="rounded border px-2 py-1 text-sm" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
            <option value="">All</option>
            {severities.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex-1" />
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Assign to</label>
            <select className="rounded border px-2 py-1 text-sm w-56" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
              <option value="">Select user…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.email} {u.role === "admin" ? "(admin)" : ""}</option>)}
            </select>
          </div>
          <button className="rounded bg-black text-white px-3 py-2 text-sm" onClick={bulkAssign} disabled={!assignUserId || selected.size === 0}>Assign Selected</button>
          <button className="rounded bg-gray-200 px-3 py-2 text-sm" onClick={bulkResolve} disabled={selected.size === 0}>Resolve Selected</button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} /></th>
              <th className="px-3 py-2">Room</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Assigned</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
                <td className="px-3 py-2">{r.room_name}</td>
                <td className="px-3 py-2">{r.type}</td>
                <td className="px-3 py-2">{r.severity ?? ""}</td>
                <td className="px-3 py-2">{r.reason ?? ""}</td>
                <td className="px-3 py-2">{r.assigned_email ?? ""}</td>
                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={7}>No flags match the filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
