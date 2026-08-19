import { useAppStore } from "@/shared/store/appStore";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/cn";
import type { DateSelection } from "@/shared/types/scope";

// Single control shared across every view (§5). Maps directly to the
// ?date=YYYY-MM-DD query param used by every scope/tuff/runs endpoint.
export function DateSelector() {
  const dateSelection = useAppStore((s) => s.dateSelection);
  const setDateSelection = useAppStore((s) => s.setDateSelection);

  const setType = (type: DateSelection["type"]) => {
    if (type === "custom") {
      const today = new Date().toISOString().slice(0, 10);
      setDateSelection({ type: "custom", date: today });
    } else {
      setDateSelection({ type });
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-md border bg-background p-1">
      {(["today", "tomorrow", "custom"] as const).map((type) => (
        <Button
          key={type}
          type="button"
          size="sm"
          variant={dateSelection.type === type ? "default" : "ghost"}
          className={cn("capitalize", dateSelection.type === type && "shadow-sm")}
          onClick={() => setType(type)}
        >
          {type}
        </Button>
      ))}
      {dateSelection.type === "custom" && (
        <Input
          type="date"
          className="h-8 w-40"
          value={dateSelection.date}
          onChange={(e) => setDateSelection({ type: "custom", date: e.target.value })}
        />
      )}
    </div>
  );
}
