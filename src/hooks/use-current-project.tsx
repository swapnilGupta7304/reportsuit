import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  project_type: "website" | "app" | "both";
  status: "active" | "archived";
  website_url: string | null;
  icon_url: string | null;
  description: string | null;
}

interface Ctx {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProjectId: (id: string) => void;
  isLoading: boolean;
  refetch: () => void;
}

const C = createContext<Ctx>({
  projects: [],
  currentProject: null,
  setCurrentProjectId: () => {},
  isLoading: false,
  refetch: () => {},
});

const LS_KEY = "cmrs:current-project";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentId, setCurrentId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, organization_id, name, project_type, status, website_url, icon_url, description")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const projects = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    if (!projects.length) { setCurrentId(null); return; }
    const stored = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (stored && projects.find(p => p.id === stored)) setCurrentId(stored);
    else setCurrentId(projects[0].id);
  }, [projects]);

  const setCurrentProjectId = (id: string) => {
    setCurrentId(id);
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, id);
  };

  const currentProject = projects.find(p => p.id === currentId) ?? null;

  return (
    <C.Provider value={{ projects, currentProject, setCurrentProjectId, isLoading, refetch }}>
      {children}
    </C.Provider>
  );
}

export const useCurrentProject = () => useContext(C);
