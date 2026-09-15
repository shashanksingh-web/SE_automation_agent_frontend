import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/shared/components/ui/drawer";
import { usePitch } from "@/shared/api/hooks/usePitch";
import { RecommendedProductCard } from "@/shared/components/RecommendedProductCard";
import { Badge } from "@/shared/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import type { AiSalesForecast } from "@/shared/types/feedback";

interface PitchPanelProps {
  // The DailyTask row's own DB id (NOT DC_ID/Sr_No) - see usePitch.ts and
  // TaskTable's comment on why this currently can't be sourced from a Task object.
  dailyTaskId: number | null;
  dcName: string | undefined;
  onClose: () => void;
}

// Script_Hindi is one flat string but always follows the same shape (planning/pitching.py's
// _compose): an opening greeting paragraph, then one or more "— <Section> —" blocks, each
// holding [पूछना]/[बताना]/[विश]-labeled lines (Ask/Tell/Wish). Parsed here so it reads as a
// script instead of one dense paragraph - never re-worded, just re-laid-out.
const SECTION_HEADER_RE = /^—\s*(.+?)\s*—$/;
const LABELED_LINE_RE = /^\[([^\]]+)\]\s*(.*)$/;

interface ParsedLine {
  label: string | null;
  text: string;
  // Multiple talking points (planning/pitching.py's _tell_lines, added 2026-09-07) -
  // when a [बताना] (Tell) line has 2+ real sentences (e.g. product recommendation +
  // suggested discount + purchase trend + YTD target, all applicable to this DC),
  // the label line itself carries empty text and each sentence gets its own
  // "-"-prefixed line right after it, rendered as a bullet list instead of one
  // dense run-on paragraph. A single sentence still renders inline via `text` -
  // never both set at once.
  bullets?: string[];
}
interface ParsedSection {
  title: string | null;
  lines: ParsedLine[];
}

function parseScript(script: string): ParsedSection[] {
  return script
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const rawLines = block
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const headerMatch = rawLines[0]?.match(SECTION_HEADER_RE);
      const title = headerMatch ? headerMatch[1] : null;
      const bodyLines = headerMatch ? rawLines.slice(1) : rawLines;

      const lines: ParsedLine[] = [];
      for (let i = 0; i < bodyLines.length; i++) {
        const line = bodyLines[i];
        const m = line.match(LABELED_LINE_RE);
        if (!m) {
          lines.push({ label: null, text: line });
          continue;
        }
        const [, label, text] = m;
        if (text) {
          lines.push({ label, text });
          continue;
        }
        // Empty-text label line -> collect the "-"-prefixed bullet lines that follow.
        const bullets: string[] = [];
        while (i + 1 < bodyLines.length && bodyLines[i + 1].startsWith("- ")) {
          bullets.push(bodyLines[++i].slice(2));
        }
        lines.push({ label, text: "", bullets });
      }
      return { title, lines };
    });
}

function ScriptBody({ script }: { script: string }) {
  const sections = parseScript(script);
  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <div key={i} className={section.title ? "border-t pt-3" : undefined}>
          {section.title && (
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{section.title}</div>
          )}
          <div className="space-y-2">
            {section.lines.map((line, j) =>
              line.label ? (
                <div key={j} className="flex gap-2">
                  <Badge variant="secondary" className="h-fit shrink-0 whitespace-nowrap">
                    {line.label}
                  </Badge>
                  {line.bullets ? (
                    <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed">
                      {line.bullets.map((b, k) => (
                        <li key={k}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm leading-relaxed">{line.text}</p>
                  )}
                </div>
              ) : (
                <p key={j} className="text-sm leading-relaxed">
                  {line.text}
                </p>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// AI-Generated Pitch's non-script output (added 2026-09-12, planning.ai_sales_forecast)
// - the AI's own reasoning/context, not shown to the DC, for whoever's reading this
// panel to see why the script above says what it says. Only rendered when Script_Hindi
// actually came from this same call (PitchPanel only mounts this when AI_Sales_Forecast
// is non-null, which the backend only ever sets alongside a winning AI script).
function AiSalesForecastSection({ forecast }: { forecast: AiSalesForecast }) {
  return (
    <div className="space-y-2 rounded-md border bg-accent/40 px-3 py-2 text-xs">
      <div className="font-semibold uppercase tracking-wide text-muted-foreground">
        AI sales forecast{forecast.Window_Days ? ` — next ${forecast.Window_Days} days` : ""}
      </div>
      {forecast.Reasoning && <p className="text-muted-foreground">{forecast.Reasoning}</p>}
      {forecast.Products.length > 0 && (
        <ul className="list-inside list-disc space-y-1">
          {forecast.Products.map((p, i) => (
            <li key={i}>
              <span className="font-medium text-foreground">{p.Name}</span>
              {p.Reason && <span className="text-muted-foreground"> — {p.Reason}</span>}
            </li>
          ))}
        </ul>
      )}
      {forecast.Club_Context && (
        <p>
          <span className="font-medium">Club:</span> <span className="text-muted-foreground">{forecast.Club_Context}</span>
        </p>
      )}
      {forecast.Scheme_Context.length > 0 && (
        <p>
          <span className="font-medium">Active schemes:</span>{" "}
          <span className="text-muted-foreground">
            {forecast.Scheme_Context.map((s) => s.Name).filter(Boolean).join(", ")}
          </span>
        </p>
      )}
      {forecast.Notes.length > 0 && (
        <div className="flex items-start gap-1.5 text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <ul className="list-inside list-disc space-y-0.5">
            {forecast.Notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// §11 - per-task pitch script panel. 404 (no pitch, e.g. Farmer Meeting) renders
// as an empty state, never an error toast. Fields match pitch_script() in
// SE_automation_server/planning/views.py, not the spec doc's guessed shape.
export function PitchPanel({ dailyTaskId, dcName, onClose }: PitchPanelProps) {
  const { data, isLoading, noPitch, generationFailed } = usePitch(dailyTaskId ?? undefined);

  return (
    <Drawer open={dailyTaskId != null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-xl">
        <DrawerHeader>
          <DrawerTitle>Pitch script</DrawerTitle>
          <DrawerDescription>{dcName}</DrawerDescription>
        </DrawerHeader>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading pitch...
          </div>
        )}

        {noPitch && generationFailed && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-4 text-sm text-destructive">
            This task has a DC and should have a pitch, but generation failed for it
            specifically - check the plan run's exceptions, or re-run Create/Refresh.
          </div>
        )}

        {noPitch && !generationFailed && (
          <div className="rounded-md border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
            No pitch available for this task.
          </div>
        )}

        {data && (
          <div className="space-y-4 overflow-auto">
            <RecommendedProductCard products={data.Recommended_Products} />

            <div className="flex items-center gap-2">
              {data.AI_Sales_Forecast && (
                <Badge
                  variant="secondary"
                  title="This script came from an AI call (planning.ai_sales_forecast), not the templated fallback - see AI Sales Forecast below for its reasoning."
                >
                  AI-Generated Script
                </Badge>
              )}
            </div>
            <ScriptBody script={data.Script_Hindi} />

            {data.AI_Sales_Forecast && <AiSalesForecastSection forecast={data.AI_Sales_Forecast} />}

            <div className="border-t pt-3 text-xs text-muted-foreground">
              {data.Purpose_Key} - generated {new Date(data.Generated_At).toLocaleString()}
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
