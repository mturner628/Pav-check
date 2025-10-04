# ================================
# File: app/api/export/flags/route.ts
# ================================
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export async function GET() {
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("flags")
    .select("id,room_id,type,severity,reason,status,created_at,rooms!inner(name,floor_id),floors:rooms_floor_id_fkey!inner(name)")
    .eq("status", "open")
    .eq("info_only", false);
  if (error) return new NextResponse(error.message, { status: 500 });

  const rows = (data ?? []).map((r:any) => ({
    floor: r.floors.name,
    room: r.rooms.name,
    flag_type: r.type,
    severity: r.severity ?? "",
    reason: r.reason ?? "",
    created_at: r.created_at
  }));

  const header = "floor,room,flag_type,severity,reason,created_at";
  const csv = [header, ...rows.map(r => [r.floor,r.room,r.flag_type,r.severity,`"${r.reason.replaceAll('"','""')}"`,r.created_at].join(","))].join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=followups.csv" } });
}
