import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plug, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentProject } from "@/hooks/use-current-project";
import { ModuleHeader } from "@/components/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/settings")({ component: Page });

const PROVIDERS = [
  { id: "ga4", label: "Google Analytics 4", desc: "Website analytics — sessions, users, events." },
  { id: "firebase", label: "Firebase Analytics", desc: "App engagement, retention, custom events." },
  { id: "play_console", label: "Google Play Console", desc: "Installs, uninstalls, ratings, crashes." },
] as const;

function Page() {
  const { user } = useAuth();
  const { currentProject } = useCurrentProject();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  const { data: integrations, isLoading: intLoading } = useQuery({
    queryKey: ["integrations", currentProject?.organization_id], enabled: !!currentProject,
    queryFn: async () => {
      const { data } = await supabase.from("integrations").select("*")
        .eq("organization_id", currentProject!.organization_id);
      return data ?? [];
    },
  });

  const [name, setName] = useState("");
  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ display_name: name || profile?.display_name }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const startOAuth = (provider: string) => {
    toast.info(`${provider} OAuth requires Google Cloud credentials. Please paste your Client ID/Secret when prompted.`);
  };

  return (
    <div className="space-y-8">
      <ModuleHeader title="Settings" subtitle="Profile, integrations, sync" />

      <Section title="Profile" desc="Update your display name and email.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Display name</Label><Input defaultValue={profile?.display_name ?? ""} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input value={profile?.email ?? user?.email ?? ""} disabled /></div>
        </div>
        <div><Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>Save</Button></div>
      </Section>

      <Section title="Integrations" desc="Connect your analytics accounts. Each org-level connection feeds all projects.">
        {!currentProject ? <p className="text-sm text-muted-foreground">Select a project first.</p> : intLoading ? <Skeleton className="h-32 rounded-xl" /> : (
          <div className="space-y-3">
            {PROVIDERS.map(p => {
              const conn = integrations?.find(i => i.provider === p.id);
              const status = conn?.status ?? "disconnected";
              return (
                <div key={p.id} className="rounded-xl border bg-card p-5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-lg bg-primary-soft text-primary grid place-items-center"><Plug className="size-5" /></div>
                    <div>
                      <div className="font-medium flex items-center gap-2">{p.label}
                        {status === "connected" ? <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="size-3" />Connected</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"><XCircle className="size-3" />Disconnected</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                      {conn?.last_synced_at && <p className="text-[10px] text-muted-foreground mt-1">Last sync: {new Date(conn.last_synced_at).toLocaleString()}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {status === "connected" && <Button size="sm" variant="outline"><RefreshCw className="size-3.5 mr-1.5" />Sync now</Button>}
                    <Button size="sm" onClick={() => startOAuth(p.label)}>{status === "connected" ? "Reconnect" : "Connect"}</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
      <div><h2 className="font-display text-lg font-semibold">{title}</h2>{desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}</div>
      {children}
    </div>
  );
}
