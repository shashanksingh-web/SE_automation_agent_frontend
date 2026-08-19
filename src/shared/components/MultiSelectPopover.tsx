import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/cn";

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectPopoverProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

// Generic cascading multi-select used by the ScopeSelector at every level (§6, §7).
export function MultiSelectPopover({
  options,
  selected,
  onChange,
  placeholder,
  loading,
  disabled,
  className,
}: MultiSelectPopoverProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.sublabel?.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("h-9 min-w-[180px] justify-between font-normal", className)}
        >
          <span className="truncate">
            {selected.length === 0
              ? placeholder
              : selected.length === 1
                ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
                : `${selected.length} selected`}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="p-2">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t px-2 py-2">
            {selected.map((v) => {
              const opt = options.find((o) => o.value === v);
              return (
                <Badge key={v} variant="secondary" className="gap-1">
                  {opt?.label ?? v}
                  <button type="button" onClick={() => toggle(v)} aria-label={`Remove ${opt?.label ?? v}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          </div>
        )}
        <div className="max-h-64 overflow-auto border-t p-1">
          {loading && <div className="px-2 py-3 text-sm text-muted-foreground">Loading...</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">No options</div>
          )}
          {!loading &&
            filtered.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={selected.includes(opt.value)}
                  onCheckedChange={() => toggle(opt.value)}
                />
                <span className="flex-1 truncate">{opt.label}</span>
                {opt.sublabel && (
                  <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
                )}
              </label>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
