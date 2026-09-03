import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/shared/components/ui/drawer";
import { useDCCard } from "@/shared/api/hooks/useDCCard";
import { ClubStandingDetail } from "@/shared/components/ClubStandingDetail";
import { BusinessAreaStrengthCard } from "@/features/dcCard/BusinessAreaStrengthCard";
import { TurnoverStandingCard } from "@/features/dcCard/TurnoverStandingCard";
import { Loader2 } from "lucide-react";

interface DCCardPanelProps {
  // The DailyTask row's own DB id (NOT DC_ID/Sr_No) - same id PitchPanel uses.
  dailyTaskId: number | null;
  dcName: string | undefined;
  onClose: () => void;
}

interface SectionItem {
  head: string;
  detail: string[];
}

// Each section is pre-formatted as newline-separated "- Label: text" bullets (one per
// build_dc_card() run() call), or a single "(no data available)"-style line when
// nothing was wired for it this run. A bullet's own text can itself be multi-line - the
// continuation lines never start with "- ", only a fresh top-level bullet does, so that
// prefix is what distinguishes "new bullet" from "detail nested under the previous one,"
// not a fixed line count.
function parseSectionItems(text: string): SectionItem[] {
  const rawLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const items: SectionItem[] = [];
  for (const line of rawLines) {
    if (line.startsWith("- ")) {
      items.push({ head: line.slice(2), detail: [] });
    } else if (items.length > 0) {
      items[items.length - 1].detail.push(line);
    } else {
      items.push({ head: line, detail: [] });
    }
  }
  return items;
}

function SectionItemsBody({ items }: { items: SectionItem[] }) {
  if (items.length === 0) return null;
  if (items.length === 1 && items[0].detail.length === 0) {
    return <p className="text-sm text-muted-foreground">{items[0].head}</p>;
  }

  return (
    <ul className="list-inside list-disc space-y-1.5 text-sm">
      {items.map((item, i) => (
        <li key={i}>
          {item.head}
          {item.detail.length > 0 && (
            <ul className="ml-4 mt-1 list-inside list-[circle] space-y-0.5 text-xs text-muted-foreground">
              {item.detail.map((line, j) => (
                <li key={j}>{line}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function SectionBody({ text }: { text: string }) {
  return <SectionItemsBody items={parseSectionItems(text)} />;
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
            <div className="rounded-md border p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">1. कौन (Who)</div>
              <BusinessAreaStrengthCard detail={data.Business_Area_Detail} />
              <TurnoverStandingCard detail={data.Turnover_Detail} />
              <ClubStandingDetail club={data.Club_Detail} />
              <SectionItemsBody
                items={parseSectionItems(data.Who_Section).filter(
                  (item) =>
                    !item.head.startsWith("Business Area Strength:") &&
                    !item.head.startsWith("Turnover-wise Standing:") &&
                    !item.head.startsWith("Scheme Standing:"),
                )}
              />
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                2. DC कहां खड़ा है (Where DC Stands)
              </div>
              <SectionBody text={data.Where_DC_Stands_Section} />
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
