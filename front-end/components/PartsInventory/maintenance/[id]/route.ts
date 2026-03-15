// src/app/api/maintenance/[id]/route.ts
// GET    /api/maintenance/[id]  — fetch one entry
// PATCH  /api/maintenance/[id]  — update one entry (partial body accepted)
// DELETE /api/maintenance/[id]  — delete one entry

import { NextRequest, NextResponse } from "next/server";
import type { MaintenanceEntry } from "@/lib/types";
import { ENTRY_STORE } from "../route";

type Params = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  { params }: Params
): Promise<NextResponse<MaintenanceEntry | { error: string }>> {
  const { id } = await params;
  const entry = ENTRY_STORE.get(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(
  req: NextRequest,
  { params }: Params
): Promise<NextResponse<MaintenanceEntry | { error: string }>> {
  const { id } = await params;
  const existing = ENTRY_STORE.get(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const patch = (await req.json()) as Partial<MaintenanceEntry>;
    const updated: MaintenanceEntry = {
      ...existing,
      ...patch,
      id,                                              // never allow id change
      scheduledDate: patch.scheduledDate
        ? new Date(patch.scheduledDate as unknown as string)
        : existing.scheduledDate,
      completedDate: patch.completedDate
        ? new Date(patch.completedDate as unknown as string)
        : existing.completedDate,
      updatedAt: new Date(),
    };
    ENTRY_STORE.set(id, updated);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: Params
): Promise<NextResponse<{ deleted: boolean }>> {
  const { id } = await params;
  ENTRY_STORE.delete(id);
  return NextResponse.json({ deleted: true });
}
