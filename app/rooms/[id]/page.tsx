# ================================
# File: app/rooms/[id]/page.tsx
# ================================
import { createSupabaseServer } from "@/src/lib/supabaseClient";
import RoomClient from "./RoomClient";

export default async function RoomPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServer();
  const { data: room } = await supabase.from("rooms").select("id,name,type,floor_id,status").eq("id", params.id).single();
  const { data: term } = await supabase.from("room_term_ids").select("*").eq("room_id", params.id).maybeSingle();
  const { data: flag } = await supabase.from("flags").select("id").eq("room_id", params.id).eq("type", "Downtime Setup").eq("info_only", true).eq("status","open").maybeSingle();
  const { data: insp } = await supabase.from("inspections").select("id").eq("room_id", params.id).order("started_at", { ascending: false }).limit(1).maybeSingle();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{room?.name} <span className="text-sm text-gray-500">{room?.type ?? ""}</span></h1>
      <RoomClient roomId={params.id} initialInspectionId={insp?.id ?? null} termIds={term} infoFlag={flag ?? null} />
    </div>
  );
}
