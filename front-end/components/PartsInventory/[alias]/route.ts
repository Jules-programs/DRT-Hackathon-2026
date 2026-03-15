// src/app/api/buses/[alias]/route.ts
// GET /api/buses/[alias]
// Returns a single bus record by alias. 404 when not found.

import { NextRequest, NextResponse } from "next/server";
import { getMockBuses } from "@/lib/mockData";
import type { BusRecord } from "@/lib/types";

type Params = { params: Promise<{ alias: string }> };

export async function GET(
  _req: NextRequest,
  { params }: Params
): Promise<NextResponse<BusRecord | { error: string }>> {
  const { alias } = await params;
  const bus = getMockBuses().find((b) => b.alias === alias);

  if (!bus) {
    return NextResponse.json({ error: `Bus '${alias}' not found` }, { status: 404 });
  }

  return NextResponse.json(bus);
}
