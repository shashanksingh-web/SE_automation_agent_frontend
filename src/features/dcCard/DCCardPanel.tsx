import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/shared/components/ui/drawer";
import { useDCCard } from "@/shared/api/hooks/useDCCard";
import { RecommendedProductCard } from "@/shared/components/RecommendedProductCard";
import { Loader2 } from "lucide-react";

interface DCCardPanelProps {
  // The DailyTask row's own DB id (NOT DC_ID/Sr_No) - same id PitchPanel uses.
  dailyTaskId: number | null;
  dcName: string | undefined;
  onClose: () => void;
}

// Each section is pre-formatted as newline-separated "- Label: text" bullets, or a
// single "(no data available)"-style line when nothing was wired for it this run.
// Rendered as a bullet list when there's more than one line, plain text otherwise.
function SectionBody({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((line) => line.trim().replace(/^-\s*/, ""))
    .filter(Boolean);

  if (lines.length === 0) return null;
  if (lines.length === 1) return <p className="text-sm text-muted-foreground">{lines[0]}</p>;

  return (
    <ul className="list-inside list-disc space-y-1 text-sm">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

// DC Card (Preface) / "Dehaat Center Ko Jaano" (planning/dc_card.py) - a second,
// complementary pre-pitch briefing shown before the Pitching Agent's own Ask/Tell/Wish.
// 3 sections matching the CSV's own structure: Who, Where DC Stands, Private Label.
// Same 404-as-empty-state contract as PitchPanel for Farmer Meeting tasks.
export function DCCardPanel({ dailyTaskId, dcName, onClose }: DCCardPanelProps) {
  const { data, isLoading, noCard, generationFailed } = useDCCard(dailyTaskId ?? undefined);

  return (
    <Drawer open={dailyTaskId != null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-xl">
        <DrawerHeader>
          <DrawerTitle>Dehaat Center Ko Jaano</DrawerTitle>
          <DrawerDescription>{dcName}</DrawerDescription>
        </DrawerHeader>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading DC card...
          </div>
        )}

        {noCard && generationFailed && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-4 text-sm text-destructive">
            This task has a DC and should have a card, but generation failed for it
            specifically - check the plan run's exceptions, or re-run Create/Refresh.
          </div>
        )}

        {noCard && !generationFailed && (
          <div className="rounded-md border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
            No DC card available for this task.
          </div>
        )}

        {data && (
          <div className="space-y-4 overflow-auto">
            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">1. कौन (Who)</div>
              <SectionBody text={data.Who_Section} />
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                2. DC कहां खड़ा है (Where DC Stands)
              </div>
              <SectionBody text={data.Where_DC_Stands_Section} />
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                3. प्राइवेट लेबल (Private Label)
              </div>
              <RecommendedProductCard products={data.Recommended_Products} />
              <div className={data.Recommended_Products.length > 0 ? "mt-3" : undefined}>
                <SectionBody text={data.Private_Label_Section} />
              </div>
            </div>

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
              Generated {new Date(data.Generated_At).toLocaleString()}
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
