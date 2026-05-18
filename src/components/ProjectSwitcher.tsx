import { Check, ChevronsUpDown, Plus, Globe, Smartphone, Layers } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useCurrentProject } from "@/hooks/use-current-project";
import { cn } from "@/lib/utils";

const icons = { website: Globe, app: Smartphone, both: Layers };

export function ProjectSwitcher() {
  const { projects, currentProject, setCurrentProjectId, isLoading } = useCurrentProject();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const Icon = currentProject ? icons[currentProject.project_type] : Layers;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="min-w-[220px] justify-between">
          <span className="flex items-center gap-2 min-w-0">
            <Icon className="size-4 text-primary shrink-0" />
            <span className="truncate">{isLoading ? "Loading…" : currentProject?.name ?? "Select project"}</span>
          </span>
          <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects…" />
          <CommandList>
            <CommandEmpty>No projects yet.</CommandEmpty>
            <CommandGroup heading="Projects">
              {projects.map(p => {
                const I = icons[p.project_type];
                return (
                  <CommandItem key={p.id} value={p.name} onSelect={() => { setCurrentProjectId(p.id); setOpen(false); }}>
                    <I className="size-4 mr-2 text-primary" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <Check className={cn("size-4", currentProject?.id === p.id ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={() => { setOpen(false); nav({ to: "/projects" }); }}>
                <Plus className="size-4 mr-2" />Manage projects
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
