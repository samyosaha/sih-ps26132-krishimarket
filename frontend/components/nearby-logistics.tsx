/**
 * NearbyLogistics — sidebar widget for the lot detail page.
 *
 * Reads the static `frontend/data/logistics.json` mapping at build time
 * (imported directly — no network fetch needed).  If the lot's district isn't
 * covered, a graceful empty state is shown instead of an error.
 */

import logisticsData from "@/data/logistics.json";
import { DISTRICTS_BY_STATE } from "@/lib/market-types";
import { Snowflake, Store, Truck, Info, MapPin } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────

type LogisticsType = "cold_storage" | "mandi";

interface LogisticsEntry {
  name: string;
  type: LogisticsType;
  distance_km: number;
}

// Cast the imported JSON to the right shape.
const DB = logisticsData as Record<string, LogisticsEntry[]>;

function normalizeString(val: string): string {
  return val.trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanDistrictName(val: string): string {
  return normalizeString(val)
    .replace(/\b(district|rural|urban|metro|metropolitan|city)\b/gi, "")
    .trim();
}

// Build pre-normalized lookup map once for fast, resilient lookups
const NORMALIZED_DB = new Map<string, { key: string; entries: LogisticsEntry[] }>();
for (const [key, entries] of Object.entries(DB)) {
  NORMALIZED_DB.set(normalizeString(key), { key, entries });
  const cleaned = cleanDistrictName(key);
  if (cleaned && !NORMALIZED_DB.has(cleaned)) {
    NORMALIZED_DB.set(cleaned, { key, entries });
  }
}

function findDistrictEntries(district: string | undefined | null): LogisticsEntry[] | null {
  if (!district) return null;
  // 1. Exact match
  if (DB[district]) return DB[district];

  // 2. Normalized match (trimmed, lowercase)
  const norm = normalizeString(district);
  if (NORMALIZED_DB.has(norm)) return NORMALIZED_DB.get(norm)!.entries;

  // 3. Suffix-cleaned match (e.g. "Bankura District" -> "bankura")
  const cleaned = cleanDistrictName(district);
  if (cleaned && NORMALIZED_DB.has(cleaned)) return NORMALIZED_DB.get(cleaned)!.entries;

  return null;
}

function findStateFallbackEntries(
  state: string | undefined | null,
  currentDistrict: string | undefined | null
): { entries: LogisticsEntry[]; sourceDistrict: string } | null {
  if (!state) return null;
  const normState = normalizeString(state);

  // Find the matching state key in DISTRICTS_BY_STATE
  const matchingStateKey = Object.keys(DISTRICTS_BY_STATE).find(
    (s) => normalizeString(s) === normState
  );
  if (!matchingStateKey) return null;

  const districtsInState = DISTRICTS_BY_STATE[matchingStateKey] || [];
  const currentClean = currentDistrict ? cleanDistrictName(currentDistrict) : "";

  for (const d of districtsInState) {
    if (cleanDistrictName(d) === currentClean) continue;
    const found = findDistrictEntries(d);
    if (found && found.length > 0) {
      return { entries: found, sourceDistrict: d };
    }
  }

  return null;
}

// ── Sub-components ────────────────────────────────────────────────────

function TypeIcon({ type }: { type: LogisticsType }) {
  if (type === "cold_storage") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40">
        <Snowflake className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
      <Store className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
    </span>
  );
}

function TypeLabel({ type }: { type: LogisticsType }) {
  if (type === "cold_storage") {
    return (
      <Badge
        variant="secondary"
        className="rounded-sm bg-sky-100 px-1.5 py-0 text-[10px] font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-900/40 dark:text-sky-300"
      >
        Cold Storage
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="rounded-sm bg-amber-100 px-1.5 py-0 text-[10px] font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300"
    >
      Mandi / APMC
    </Badge>
  );
}

// ── Main export ───────────────────────────────────────────────────────

interface Props {
  /** District name from the lot — e.g. "Bankura", "Nashik". */
  district: string | undefined | null;
  /** State name from the lot — e.g. "West Bengal", "Maharashtra". */
  state?: string | undefined | null;
}

export function NearbyLogistics({ district, state }: Props) {
  const directEntries = findDistrictEntries(district);
  let isRegional = false;
  let sourceDistrict: string | undefined;
  let rawEntries: LogisticsEntry[] = [];

  if (directEntries && directEntries.length > 0) {
    rawEntries = directEntries;
  } else {
    // Attempt state-level regional fallback
    const fallback = findStateFallbackEntries(state, district);
    if (fallback && fallback.entries.length > 0) {
      rawEntries = fallback.entries;
      isRegional = true;
      sourceDistrict = fallback.sourceDistrict;
    }
  }

  const sorted = [...rawEntries].sort((a, b) => a.distance_km - b.distance_km);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4 text-emerald-600" aria-hidden />
          Nearby Storage &amp; Mandis
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {sorted.length === 0 ? (
          /* ── Empty / unknown district ─────────────────────────── */
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-6 text-center">
            <Info className="h-5 w-5 text-muted-foreground/60" aria-hidden />
            <p className="text-xs text-muted-foreground">
              Logistics info not yet available for this district.
            </p>
          </div>
        ) : (
          /* ── Entry list ───────────────────────────────────────── */
          <>
            {isRegional && (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50/80 p-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-200">
                  <MapPin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                  Regional / State facilities
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Direct facilities not yet recorded in {district || "this district"}. Showing regional hubs in {state}{sourceDistrict ? ` (${sourceDistrict})` : ""}.
                </p>
              </div>
            )}
            <ul className="divide-y" role="list" aria-label="Nearby logistics facilities">
              {sorted.map((entry, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <TypeIcon type={entry.type} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-snug">
                      {entry.name}
                    </p>
                    <TypeLabel type={entry.type} />
                  </div>

                  <span
                    className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground"
                    title={`${entry.distance_km} km away`}
                  >
                    {entry.distance_km}&nbsp;km
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Legend */}
        {sorted.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Snowflake className="h-3 w-3 text-sky-500" aria-hidden />
              Cold Storage
            </span>
            <span className="inline-flex items-center gap-1">
              <Store className="h-3 w-3 text-amber-500" aria-hidden />
              Mandi / APMC
            </span>
            <span className="ml-auto italic">Approx. distances</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
