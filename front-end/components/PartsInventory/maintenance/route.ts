// src/app/api/maintenance/route.ts
// GET  /api/maintenance          — list all entries (optionally filtered by ?busAlias=)
// POST /api/maintenance          — create a new maintenance entry
//
// NOTE: This is an in-memory store for development/demo.
// In production, replace the store with a real database (Prisma + Postgres, etc.)

import { NextRequest, NextResponse } from "next/server";
import type { MaintenanceEntry } from "@/lib/types";

// ── In-memory store ───────────────────────────────────────────────────────────
// Exported so the [id] route can share the same reference.
export const ENTRY_STORE = new Map<string, MaintenanceEntry>();

export async function GET(
  req: NextRequest
): Promise<NextResponse<MaintenanceEntry[]>> {
  const busAlias = req.nextUrl.searchParams.get("busAlias");
  const all = Array.from(ENTRY_STORE.values());

  const filtered = busAlias
    ? all.filter((e) => e.busAlias === busAlias)
    : all;

  // Sort newest first
  filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json(filtered);
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<MaintenanceEntry | { error: string }>> {
  try {
    const body = (await req.json()) as Partial<MaintenanceEntry>;

    if (!body.id || !body.busAlias || !body.serviceLevel) {
      return NextResponse.json(
        { error: "Missing required fields: id, busAlias, serviceLevel" },
        { status: 400 }
      );
    }

    // Rehydrate dates (JSON serialisation strips Date objects)
    const entry: MaintenanceEntry = {
      ...(body as MaintenanceEntry),
      scheduledDate: new Date(body.scheduledDate as unknown as string),
      completedDate: body.completedDate
        ? new Date(body.completedDate as unknown as string)
        : null,
      createdAt: new Date(body.createdAt as unknown as string),
      updatedAt: new Date(),
    };

    ENTRY_STORE.set(entry.id, entry);
    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
