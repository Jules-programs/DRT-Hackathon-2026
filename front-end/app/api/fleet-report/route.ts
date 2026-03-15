import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import { buildBusRiskReport } from "@/lib/risk";
import type { BusRiskReport } from "@/lib/types";

const AS_OF_DATE = new Date("2026-03-14T00:00:00");

const CURRENT_CANDIDATES = [
  "pm-current.csv",
  "Preventative Maintenance Open Activities.csv",
];

const PREVIOUS_CANDIDATES = [
  "pm-previous.csv",
  "20260212 Preventative Maintenance Open Activities.csv",
];

const dataDir = path.join(process.cwd(), "public", "data");

async function readFirstExisting(
  filenames: readonly string[]
): Promise<{ filename: string; text: string } | null> {
  for (const filename of filenames) {
    const fullPath = path.join(dataDir, filename);
    try {
      const text = await fs.readFile(fullPath, "utf8");
      return { filename, text };
    } catch {
      // Keep trying fallback names.
    }
  }
  return null;
}

export async function GET(): Promise<NextResponse<BusRiskReport | { error: string }>> {
  try {
    const current = await readFirstExisting(CURRENT_CANDIDATES);
    if (!current) {
      return NextResponse.json(
        {
          error:
            `Could not find current CSV in ${dataDir}. ` +
            `Expected one of: ${CURRENT_CANDIDATES.join(", ")}`,
        },
        { status: 404 }
      );
    }

    const previous = await readFirstExisting(PREVIOUS_CANDIDATES);

    const report = buildBusRiskReport(
      current.text,
      previous?.text,
      AS_OF_DATE
    );

    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
