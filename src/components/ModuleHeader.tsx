import { format } from "date-fns";
import { useDateRange } from "@/hooks/use-date-range";
import { useCurrentProject } from "@/hooks/use-current-project";

interface Props { title: string; subtitle?: string; }
export function ModuleHeader({ title, subtitle }: Props) {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        {subtitle ? subtitle + " · " : ""}{currentProject?.name ?? "No project"} · {format(range.from, "MMM d")} – {format(range.to, "MMM d, yyyy")}
      </p>
    </div>
  );
}
