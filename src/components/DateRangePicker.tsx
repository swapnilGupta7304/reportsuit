import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useDateRange, type DatePreset } from "@/hooks/use-date-range";
import { cn } from "@/lib/utils";

const presets: { id: DatePreset; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
];

export function DateRangePicker() {
  const { range, setPreset, setCustom } = useDateRange();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarIcon className="size-4 text-primary" />
          <span className="text-sm">{format(range.from, "MMM d")} – {format(range.to, "MMM d, yyyy")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex">
          <div className="flex flex-col p-2 border-r bg-muted/30 min-w-[140px]">
            {presets.map(p => (
              <button key={p.id} onClick={() => setPreset(p.id)} className={cn(
                "text-left text-sm px-3 py-2 rounded-md hover:bg-accent",
                range.preset === p.id && "bg-accent text-accent-foreground font-medium"
              )}>{p.label}</button>
            ))}
          </div>
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={{ from: range.from, to: range.to }}
            onSelect={(r) => { if (r?.from && r?.to) setCustom(r.from, r.to); }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
