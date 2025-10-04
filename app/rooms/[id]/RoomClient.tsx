
# ================================
# File: app/rooms/[id]/RoomClient.tsx
# ================================
"use client";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/src/lib/supabaseClient";
import type { Equipment } from "@/src/lib/types";
import { FLAG_TYPES, SEVERITIES } from "@/src/lib/constants";

type ExpectedRow = {
  expected_id: string;
  equipment: Equipment;
  qty_expected: number;
  required: boolean;
  item_id: string | null;
  present: boolean | null;
  qty_verified: number | null;
  notes: string | null;
};

type RoomFlag = {
  id: string;
  type: string;
  severity: string | null;
  reason: string | null;
  status: string;
  created_at: string;
};

export default function RoomClient({ roomId, initialInspectionId, termIds, infoFlag }: {
  roomId: string;
  initialInspectionId: string | null;
  termIds: { pc_term_id1?: string|null; pc_term_id2?: string|null; printer_term_id1?: string|null; printer_term_id2?: string|null } | null;
  infoFlag: { id: string } | null;
}) {
  const supabase = createSupabaseBrowser();
  const [inspectionId, setInspectionId] = useState<string | null>(initialInspectionId);
  const [rows, setRows] = useState<ExpectedRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);

  const [flags, setFlags] = useState<RoomFlag[]>([]);
  const [newType, setNewType] = useState<typeof FLAG_TYPES[number] | "">("");
  const [newSeverity, setNewSeverity] = useState<typeof SEVERITIES[number] | "">("");
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    const channel = supabase.channel(`room-${roomId}`, { config: { presence: { key: Math.random().toString(36).slice(2) } } });
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setPresenceCount(Object.keys(state).length);
    });
    channel.subscribe(async (status) => { if (status === "SUBSCRIBED") await channel.track({ at: Date.now() }); });
    return () => { supabase.removeChannel(channel); };
  }, [roomId, supabase]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_or_create_inspection_for_room", { p_room_id: roomId });
      setInspectionId(data?.id ?? null);
    })();
  }, [roomId, supabase]);

  useEffect(() => {
    if (!inspectionId) return;
    (async () => {
      const { data } = await supabase.from("expected_equipment")
        .select(`
          id,
          qty_expected,
          required,
          equipment:equipment(id,code,name,category),
          items:inspection_items!left(id,present,qty_verified,notes)
        `)
        .eq("room_id", roomId)
        .eq("items.inspection_id", inspectionId);
      const normalized: ExpectedRow[] = (data ?? []).map((d: any) => ({
        expected_id: d.id,
        equipment: d.equipment,
        qty_expected: d.qty_expected,
        required: d.required,
        item_id: d.items?.[0]?.id ?? null,
        present: d.items?.[0]?.present ?? null,
        qty_verified: d.items?.[0]?.qty_verified ?? null,
        notes: d.items?.[0]?.notes ?? null
      }));
      setRows(normalized);
    })();
  }, [inspectionId, roomId, supabase]);

  async function upsertItem(idx: number, patch: Partial<ExpectedRow>) {
    if (!inspectionId) return;
    setSaving(true);
    const row = rows[idx];
    if (!row.item_id) {
      const { data, error } = await supabase.from("inspection_items").insert({
        inspection_id: inspectionId,
        equipment_id: row.equipment.id,
        present: patch.present ?? row.present,
        qty_verified: patch.qty_verified ?? row.qty_verified,
        notes: patch.notes ?? row.notes
      }).select("id").single();
      if (!error && data) {
        setRows(prev => { const n = [...prev]; n[idx] = { ...n[idx], item_id: data.id, ...patch }; return n; });
      }
    } else {
      await supabase.from("inspection_items").update({
        present: patch.present ?? row.present,
        qty_verified: patch.qty_verified ?? row.qty_verified,
        notes: patch.notes ?? row.notes
      }).eq("id", row.item_id);
      setRows(prev => { const n = [...prev]; n[idx] = { ...n[idx], ...patch }; return n; });
    }
    setSaving(false);
  }

  const completion = useMemo(() => {
    const total = rows.length;
    if (total === 0) return 0;
    const ok = rows.filter(r => {
      if (r.qty_expected > 0) return r.qty_verified != null && r.qty_verified >= r.qty_expected;
      if (r.required) return r.present === true;
      return r.present !== null;
    }).length;
    return Math.round((ok / total) * 100);
  }, [rows]);

  async function loadFlags() {
    const { data } = await supabase.from("flags").select("id,type,severity,reason,status,created_at,info_only").eq("room_id", roomId).eq("status", "open");
    setFlags((data ?? []).filter((f: any) => !f.info_only));
  }
  useEffect(() => {
    loadFlags();
    const ch = supabase
      .channel(`flags-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "flags", filter: `room_id=eq.${roomId}` }, () => loadFlags())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, supabase]);

  async function addFlag() {
    if (!newType) return;
    await supabase.from("flags").insert({
      room_id: roomId,
      type: newType,
      severity: newSeverity || null,
      reason: newReason || null,
      info_only: false,
      status: "open"
    });
    setNewType(""); setNewSeverity(""); setNewReason("");
    await loadFlags();
  }

  async function resolveFlag(id: string) {
    await supabase.from("flags").update({ status: "closed", resolved_at: new Date().toISOString() }).eq("id", id);
    await loadFlags();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="w-full">
          <div className="h-2 w-full rounded bg-gray-200">
            <div className="h-2 rounded bg-black transition-all" style={{ width: `${completion}%` }} />
          </div>
          <div className="mt-1 text-xs text-gray-600">{completion}% complete (excludes Term IDs & Downtime Setup)</div>
        </div>
        <div className="text-xs rounded bg-gray-100 px-2 py-1">👥 {presenceCount}</div>
        {infoFlag && <span className="text-xs rounded bg-yellow-100 px-2 py-1">Downtime Setup (info)</span>}
        {saving && <span className="text-xs">Saving…</span>}
      </div>

      {termIds && (termIds.pc_term_id1 || termIds.pc_term_id2 || termIds.printer_term_id1 || termIds.printer_term_id2) && (
        <div className="rounded-2xl border bg-white p-3">
          <div className="font-medium mb-2">Term IDs (not counted)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {termIds.pc_term_id1 && <div>PC Term ID: <b>{termIds.pc_term_id1}</b></div>}
            {termIds.pc_term_id2 && <div>PC Term ID 2: <b>{termIds.pc_term_id2}</b></div>}
            {termIds.printer_term_id1 && <div>Printer Term ID: <b>{termIds.printer_term_id1}</b></div>}
            {termIds.printer_term_id2 && <div>Printer Term ID 2: <b>{termIds.printer_term_id2}</b></div>}
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-white p-3">
        <div className="font-medium mb-2">Equipment</div>
        <div className="space-y-3">
          {rows.map((r, idx) => (
            <div key={r.expected_id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b pb-2">
              <div>
                <div className="font-medium">{r.equipment.name} <span className="text-xs text-gray-500">({r.equipment.code})</span></div>
                <div className="text-xs text-gray-500">Expected: {r.qty_expected}{r.required ? "" : " (optional)"}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={r.present ?? false} onChange={e => upsertItem(idx, { present: e.target.checked })} />
                  Present
                </label>
                <input
                  type="number" placeholder="Qty verified"
                  className="w-28 rounded border px-2 py-1 text-sm"
                  value={r.qty_verified ?? ""}
                  onChange={e => upsertItem(idx, { qty_verified: e.target.value === "" ? null : Number(e.target.value) })}
                />
                <input
                  type="text" placeholder="Notes"
                  className="w-56 rounded border px-2 py-1 text-sm"
                  value={r.notes ?? ""}
                  onChange={e => upsertItem(idx, { notes: e.target.value })}
                />
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="text-sm text-gray-500">No expected equipment configured.</div>}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Flags (follow-ups)</div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Type</label>
            <select className="w-full rounded border px-2 py-1 text-sm" value={newType} onChange={(e) => setNewType(e.target.value as any)}>
              <option value="">Select…</option>
              {FLAG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Severity</label>
            <select className="w-36 rounded border px-2 py-1 text-sm" value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as any)}>
              <option value="">(none)</option>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Reason / Notes</label>
            <input className="w-full rounded border px-2 py-1 text-sm" placeholder="Short description" value={newReason} onChange={(e) => setNewReason(e.target.value)} />
          </div>
          <button className="rounded bg-black text-white px-3 py-2 text-sm" onClick={addFlag} disabled={!newType} title={!newType ? "Select a type" : ""}>
            Add Flag
          </button>
        </div>

        <div className="space-y-2">
          {flags.length === 0 && <div className="text-sm text-gray-500">No open flags.</div>}
          {flags.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded border px-3 py-2">
              <div className="text-sm">
                <span className="font-medium">{f.type}</span>
                {f.severity && <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs">{f.severity}</span>}
                {f.reason && <span className="ml-2 text-gray-600">— {f.reason}</span>}
              </div>
              <button className="text-sm rounded bg-gray-200 px-2 py-1" onClick={() => resolveFlag(f.id)}>Mark resolved</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
