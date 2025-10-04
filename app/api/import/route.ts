
# ================================
# File: app/api/import/route.ts
# ================================
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function pick(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    if (k in row) {
      const v = String(row[k] ?? "").trim();
      if (v) return v;
    }
  }
  return "";
}
function parseQty(v: any): number {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return 0;
  if (["Y","YES","TRUE"].includes(s)) return 1;
  const n = parseFloat(s.replace(/,/g,""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
function hasDowntime(v: any): boolean {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return false;
  if (["1","Y","YES","TRUE","PRESENT"].includes(s)) return true;
  return true; /* any non-empty text counts */
}

export async function POST(req: Request) {
  const body = await req.json();
  const rows: Record<string, any>[] = body.rows ?? [];
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: b } = await supabase.from("buildings").select("id").order("name").limit(1).maybeSingle();
    const buildingId = b?.id ?? (await supabase.from("buildings").insert({ name: "Main Hospital" }).select("id").single()).data!.id;

    const floorIdByName = new Map<string, string>();
    const equipIdByCode = new Map<string, string>();

    async function getFloorId(name: string) {
      if (floorIdByName.has(name)) return floorIdByName.get(name)!;
      const { data: ex } = await supabase.from("floors").select("id").eq("building_id", buildingId).eq("name", name).maybeSingle();
      if (ex) { floorIdByName.set(name, ex.id); return ex.id; }
      const sortIndex = floorIdByName.size;
      const { data: ins } = await supabase.from("floors").insert({ building_id: buildingId, name, sort_index: sortIndex }).select("id").single();
      floorIdByName.set(name, ins!.id);
      return ins!.id;
    }
    async function getEquipId(colName: string) {
      const code = colName.trim().replace(/\s+/g,"_").toUpperCase();
      if (equipIdByCode.has(code)) return equipIdByCode.get(code)!;
      const { data: ex } = await supabase.from("equipment").select("id").eq("code", code).maybeSingle();
      if (ex) { equipIdByCode.set(code, ex.id); return ex.id; }
      const { data: ins } = await supabase.from("equipment").insert({ code, name: colName }).select("id").single();
      equipIdByCode.set(code, ins!.id);
      return ins!.id;
    }

    const skipCols = new Set(["Floor","Level","Room","Room Number","Room Type","Room Name","PC Term ID","PC Term ID 2","Printer Term ID","Printer Term ID2","Downtime Setup"]);

    let createdRooms = 0, expectedUpserts = 0, downtimeFlags = 0, termBoxes = 0;

    for (const r of rows) {
      const floorName = pick(r, ["Floor","Level"]);
      const roomNumber = pick(r, ["Room","Room Number"]);
      const roomType = pick(r, ["Room Type","Room Name"]) || null;
      if (!floorName || !roomNumber) continue;
      const floorId = await getFloorId(floorName);

      const { data: room } = await supabase.from("rooms").select("id,type").eq("floor_id", floorId).eq("name", roomNumber).maybeSingle();
      let roomId: string;
      if (!room) {
        roomId = (await supabase.from("rooms").insert({ floor_id: floorId, name: roomNumber, type: roomType }).select("id").single()).data!.id;
        createdRooms++;
      } else {
        roomId = room.id;
        if (roomType && room.type !== roomType) await supabase.from("rooms").update({ type: roomType }).eq("id", roomId);
      }

      const termPayload = {
        pc_term_id1: pick(r, ["PC Term ID"]) || null,
        pc_term_id2: pick(r, ["PC Term ID 2"]) || null,
        printer_term_id1: pick(r, ["Printer Term ID"]) || null,
        printer_term_id2: pick(r, ["Printer Term ID2"]) || null
      };
      if (termPayload.pc_term_id1 || termPayload.pc_term_id2 || termPayload.printer_term_id1 || termPayload.printer_term_id2) {
        await supabase.from("room_term_ids").upsert({ room_id: roomId, ...termPayload });
        termBoxes++;
      }

      const downtimeRaw = pick(r, ["Downtime Setup"]);
      if (hasDowntime(downtimeRaw)) {
        const { data: existing } = await supabase
          .from("flags")
          .select("id")
          .eq("room_id", roomId)
          .eq("type", "Downtime Setup")
          .eq("info_only", true)
          .eq("status", "open")
          .maybeSingle();
        if (!existing) {
          const reason = downtimeRaw ? String(downtimeRaw) : "Present";
          await supabase.from("flags").insert({ room_id: roomId, type: "Downtime Setup", severity: null, reason, info_only: true, status: "open" });
          downtimeFlags++;
        }
      }

      for (const [key, raw] of Object.entries(r)) {
        if (skipCols.has(key)) continue;
        const qty = parseQty(raw);
        if (qty <= 0) continue;
        const eqId = await getEquipId(key);
        const { data: ex } = await supabase.from("expected_equipment").select("id,qty_expected").eq("room_id", roomId).eq("equipment_id", eqId).maybeSingle();
        if (!ex) {
          await supabase.from("expected_equipment").insert({ room_id: roomId, equipment_id: eqId, required: true, qty_expected: qty });
          expectedUpserts++;
        } else if ((ex.qty_expected ?? 0) < qty) {
          await supabase.from("expected_equipment").update({ qty_expected: qty }).eq("id", ex.id);
          expectedUpserts++;
        }
      }

      const { data: insp } = await supabase.from("inspections").select("id").eq("room_id", roomId).order("started_at",{ascending:false}).limit(1).maybeSingle();
      if (!insp) await supabase.from("inspections").insert({ room_id: roomId, status: "in_progress" });
    }

    return new NextResponse(
      `Import complete.
Rooms created: ${createdRooms}
Expected upserts: ${expectedUpserts}
Downtime flags: ${downtimeFlags}
Rooms with Term IDs: ${termBoxes}
Verified counts remain EMPTY.`,
      { status: 200 }
    );
  } catch (e: any) {
    return new NextResponse("Import error: " + e.message, { status: 500 });
  }
}
