import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/shared/components/ui/drawer";
import { usePitch } from "@/shared/api/hooks/usePitch";
import { RecommendedProductCard } from "@/shared/components/RecommendedProductCard";
import { Badge } from "@/shared/components/ui/badge";
import { Loader2 } from "lucide-react";

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
      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const headerMatch = lines[0]?.match(SECTION_HEADER_RE);
      const title = headerMatch ? headerMatch[1] : null;
      const bodyLines = headerMatch ? lines.slice(1) : lines;
      return {
        title,
        lines: bodyLines.map((line) => {
          const m = line.match(LABELED_LINE_RE);
          return m ? { label: m[1], text: m[2] } : { label: null, text: line };
        }),
      };
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
                  <p className="text-sm leading-relaxed">{line.text}</p>
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

            <ScriptBody script={data.Script_Hindi} />

            <div className="flex flex-wrap gap-4 border-t pt-3">
              {data.Data_Sources_Used.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Data sources used
                  </div>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {data.Data_Sources_Used.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {data.Data_Sources_Skipped.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Data sources skipped
                  </div>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {data.Data_Sources_Skipped.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.Purpose_Key} - generated {new Date(data.Generated_At).toLocaleString()}
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
