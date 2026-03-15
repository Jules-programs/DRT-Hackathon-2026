// src/app/api/parse-csv/route.ts
// POST /api/parse-csv
// Accepts a multipart/form-data upload with a `file` field (CSV).
// Returns an array of parsed, deduplicated PMRecord objects.

import { NextRequest, NextResponse } from "next/server";
import { csvToPMRecords } from "@/lib/csv";
import type { PMRecord } from "@/lib/types";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(
  req: NextRequest
): Promise<NextResponse<PMRecord[] | { error: string }>> {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing field: file (CSV)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 10 MB limit" },
        { status: 413 }
      );
    }

    const text    = await file.text();
    const records = csvToPMRecords(text);

    return NextResponse.json(records);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
