# ================================
# File: app/admin/import/page.tsx
# ================================
"use client";
import Papa from "papaparse";
import { useState } from "react";

export default function ImportPage() {
  const [log, setLog] = useState<string>("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLog("Parsing CSV…");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        setLog(`Parsed ${res.data.length} rows. Uploading…`);
        const r = await fetch("/api/import", { method: "POST", body: JSON.stringify({ rows: res.data }) });
        const t = await r.text();
        setLog(t);
      },
      error: (err) => setLog("Parse error: " + err.message)
    });
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-semibold">Import Rooms & Equipment</h1>
      <ol className="list-decimal pl-4 text-sm text-gray-700 space-y-1">
        <li>Export your spreadsheet as CSV.</li>
        <li>Headers supported: <code>Level|Floor</code>, <code>Room Number|Room</code>, optional <code>Room Type|Room Name</code>, <code>PC Term ID</code>, <code>PC Term ID 2</code>, <code>Printer Term ID</code>, <code>Printer Term ID2</code>, <code>Downtime Setup</code>. All other numeric columns are equipment quantities.</li>
      </ol>
      <input type="file" accept=".csv" onChange={handleFile} />
      <pre className="rounded bg-gray-900 text-gray-100 p-3 text-xs whitespace-pre-wrap">{log}</pre>
    </div>
  );
}
