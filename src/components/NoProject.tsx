import { FolderKanban } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { EmptyState } from "./EmptyState";
import { useCurrentProject } from "@/hooks/use-current-project";

export function NoProjectGate({ children }: { children: React.ReactNode }) {
  const { currentProject, isLoading } = useCurrentProject();
  const nav = useNavigate();
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!currentProject) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No project selected"
        description="Create or select a project to view analytics."
        actionLabel="Manage projects"
        onAction={() => nav({ to: "/projects" })}
      />
    );
  }
  return <>{children}</>;
}
