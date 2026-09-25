import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/cn";

export interface SingleSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SingleSelectComboboxProps {
  options: SingleSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

// Searchable single-select (added 2026-09-14, UsersPanel's Employee ID pickers) -
// MultiSelectPopover's sibling: same search-a-real-directory-list pattern, but picking
// one immediately selects and closes rather than toggling a checkbox into a growing
// selection. Built as its own component rather than a "single mode" flag on
// MultiSelectPopover - that component's checkbox rows imply "pick several," which is
// the wrong affordance here (a login username is exactly one employee).
export function SingleSelectCombobox({
  options,
  value,
  onChange,
  placeholder,
  loading,
  disabled,
  className,
}: SingleSelectComboboxProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.sublabel?.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = options.find((o) => o.value === value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("h-9 min-w-[180px] justify-between font-normal", className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
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
        <div className="max-h-64 overflow-auto border-t p-1">
          {loading && <div className="px-2 py-3 text-sm text-muted-foreground">Loading...</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">No options</div>
          )}
          {!loading &&
            filtered.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check className={cn("h-3.5 w-3.5 shrink-0", opt.value === value ? "opacity-100" : "opacity-0")} />
                <span className="flex-1 truncate">{opt.label}</span>
                {opt.sublabel && <span className="text-xs text-muted-foreground">{opt.sublabel}</span>}
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
