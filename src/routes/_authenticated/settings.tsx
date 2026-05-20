import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plug, CheckCircle2, XCircle, RefreshCw, Link2, Smartphone, Globe, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentProject } from "@/hooks/use-current-project";
import { ModuleHeader } from "@/components/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  listGa4Properties, linkGa4Property, syncProjectNow, getGa4PropertyForProject,
  linkPlayConsoleApp, syncPlayConsoleNow, getPlayConsoleStatus,
} from "@/lib/integrations.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Page,
  validateSearch: (s: Record<string, unknown>) => ({
    connected: typeof s.connected === "string" ? s.connected : undefined,
    oauth_error: typeof s.oauth_error === "string" ? s.oauth_error : undefined,
  }),
});

const PROVIDERS = [
  { id: "ga4" as const, label: "Google Analytics 4", desc: "Website analytics — sessions, users, events.", oauth: true, icon: Globe },
  { id: "play_console" as const, label: "Google Play Console", desc: "Installs, crashes, ANR — via service account.", oauth: false, icon: Smartphone },
];

function Page() {
  const { user } = useAuth();
  const { currentProject } = useCurrentProject();
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/settings" });

  useEffect(() => {
    if (search.connected) {
      toast.success(`Connected ${search.connected.toUpperCase()}`);
      qc.invalidateQueries({ queryKey: ["integrations"] });
      window.history.replaceState({}, "", "/settings");
    }
    if (search.oauth_error) {
      toast.error(`OAuth error: ${search.oauth_error}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [search.connected, search.oauth_error, qc]);

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
      const { error } = await supabase.from("profiles")
        .update({ display_name: name || profile?.display_name }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const startOAuth = (provider: string) => {
    if (!currentProject || !user) { toast.error("Select a project first"); return; }
    const url = `/api/public/oauth/google/start?org=${currentProject.organization_id}&user=${user.id}&provider=${provider}&return=/settings`;
    window.location.href = url;
  };

  const ga4Integration = integrations?.find(i => i.provider === "ga4" && i.status === "connected");

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
              const Icon = p.icon;
              return (
                <div key={p.id} className="rounded-xl border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-lg bg-primary-soft text-primary grid place-items-center"><Icon className="size-5" /></div>
                    <div>
                      <div className="font-medium flex items-center gap-2 flex-wrap">{p.label}
                        {status === "connected" ? <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="size-3" />Connected</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"><XCircle className="size-3" />Disconnected</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                      {conn?.account_label && <p className="text-[11px] text-muted-foreground mt-1">Account: {conn.account_label}</p>}
                      {conn?.last_synced_at && <p className="text-[10px] text-muted-foreground">Last sync: {new Date(conn.last_synced_at).toLocaleString()}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {p.oauth ? (
                      <Button size="sm" onClick={() => startOAuth(p.id)}>{status === "connected" ? "Reconnect" : "Connect"}</Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {ga4Integration && currentProject && (
        <Ga4ProjectSection
          integrationId={ga4Integration.id}
          projectId={currentProject.id}
          projectName={currentProject.name}
          autoOpen={search.connected === "ga4"}
        />
      )}

      {currentProject && (
        <PlayConsoleSection projectId={currentProject.id} projectName={currentProject.name} />
      )}
    </div>
  );
}

function Ga4ProjectSection({ integrationId, projectId, projectName, autoOpen }: { integrationId: string; projectId: string; projectName: string; autoOpen?: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listGa4Properties);
  const linkFn = useServerFn(linkGa4Property);
  const syncFn = useServerFn(syncProjectNow);
  const getLinkedFn = useServerFn(getGa4PropertyForProject);

  const { data: linked, isLoading: linkedLoading } = useQuery({
    queryKey: ["ga4-linked", projectId],
    queryFn: () => getLinkedFn({ data: { projectId } }),
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string>("");

  const { data: properties, isLoading: propsLoading } = useQuery({
    queryKey: ["ga4-properties", integrationId],
    enabled: pickerOpen,
    queryFn: () => listFn({ data: { integrationId } }),
  });

  const sync = useMutation({
    mutationFn: () => syncFn({ data: { projectId } }),
    onSuccess: (r: any) => {
      toast.success(`GA4 synced · ${Object.entries(r.totals).map(([k, v]) => `${k}:${v}`).join("  ")}`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const link = useMutation({
    mutationFn: async () => {
      const p = properties?.find(x => x.propertyId === selectedProperty);
      return linkFn({ data: { integrationId, projectId, propertyId: selectedProperty, propertyName: p ? `${p.account} · ${p.displayName}` : undefined } });
    },
    onSuccess: () => {
      toast.success("GA4 property linked — syncing 90 days…");
      setPickerOpen(false);
      qc.invalidateQueries({ queryKey: ["ga4-linked", projectId] });
      sync.mutate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (autoOpen && !linkedLoading && !linked) setPickerOpen(true);
  }, [autoOpen, linkedLoading, linked]);

  return (
    <Section title={`GA4 — ${projectName}`} desc="Link a GA4 property to this project. Sync pulls the last 90 days in the property's timezone.">
      {linkedLoading ? <Skeleton className="h-16 rounded-lg" /> : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm">
            {linked ? (
              <>
                <div className="font-medium flex items-center gap-2"><Link2 className="size-4 text-primary" />{linked.property_name || `Property ${linked.property_id}`}</div>
                <div className="text-xs text-muted-foreground">Property ID: {linked.property_id}{linked.timezone ? ` · ${linked.timezone}` : ""}{linked.currency_code ? ` · ${linked.currency_code}` : ""}</div>
              </>
            ) : (
              <span className="text-muted-foreground">No GA4 property linked to this project yet.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>{linked ? "Change property" : "Pick property"}</Button>
            {linked && <Button size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCw className={`size-3.5 mr-1.5 ${sync.isPending ? "animate-spin" : ""}`} />
              {sync.isPending ? "Syncing…" : "Sync now"}
            </Button>}
          </div>
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Select GA4 property</DialogTitle></DialogHeader>
          {propsLoading ? <Skeleton className="h-10" /> : !properties?.length ? (
            <p className="text-sm text-muted-foreground">No GA4 properties available for this Google account.</p>
          ) : (
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger><SelectValue placeholder="Choose a property" /></SelectTrigger>
              <SelectContent>
                {properties.map(p => (
                  <SelectItem key={p.propertyId} value={p.propertyId}>
                    {p.account} · {p.displayName} ({p.propertyId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button disabled={!selectedProperty || link.isPending} onClick={() => link.mutate()}>Link property</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function PlayConsoleSection({ projectId, projectName }: { projectId: string; projectName: string }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getPlayConsoleStatus);
  const linkFn = useServerFn(linkPlayConsoleApp);
  const syncFn = useServerFn(syncPlayConsoleNow);

  const { data, isLoading } = useQuery({
    queryKey: ["play-status", projectId],
    queryFn: () => statusFn({ data: { projectId } }),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pkg, setPkg] = useState("");
  const [appName, setAppName] = useState("");

  const link = useMutation({
    mutationFn: () => linkFn({ data: { projectId, packageName: pkg, appName: appName || undefined } }),
    onSuccess: () => {
      toast.success("Play Console app linked — starting sync…");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["play-status", projectId] });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      sync.mutate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const sync = useMutation({
    mutationFn: () => syncFn({ data: { projectId } }),
    onSuccess: (r: any) => {
      toast.success(`Play Console synced · ${r.days} days`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const app = data?.app;
  const sa = data?.serviceAccountEmail;

  return (
    <Section title={`Google Play Console — ${projectName}`} desc="Service-account integration. Invite the service account email below to your Play Console with read access, then enter your app's package name.">
      {isLoading ? <Skeleton className="h-20 rounded-lg" /> : (
        <div className="space-y-4">
          {sa ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
              <div className="text-xs">
                <div className="text-muted-foreground">Service account</div>
                <code className="font-mono text-xs">{sa}</code>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(sa); toast.success("Copied"); }}>
                <Copy className="size-3.5" />
              </Button>
            </div>
          ) : (
            <p className="text-xs text-destructive">Service account not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON secret.</p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm">
              {app ? (
                <>
                  <div className="font-medium flex items-center gap-2"><Smartphone className="size-4 text-primary" />{app.app_name || app.package_name}</div>
                  <div className="text-xs text-muted-foreground">Package: <code className="font-mono">{app.package_name}</code></div>
                  {app.last_synced_at && <div className="text-[10px] text-muted-foreground">Last sync: {new Date(app.last_synced_at).toLocaleString()}</div>}
                </>
              ) : (
                <span className="text-muted-foreground">No Play Console app linked to this project yet.</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setPkg(app?.package_name ?? ""); setAppName(app?.app_name ?? ""); setDialogOpen(true); }}>
                {app ? "Change app" : "Connect"}
              </Button>
              {app && (
                <Button size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
                  <RefreshCw className={`size-3.5 mr-1.5 ${sync.isPending ? "animate-spin" : ""}`} />
                  {sync.isPending ? "Syncing…" : "Sync now"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Connect Google Play Console</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              In Play Console: <strong>Users and permissions → Invite new user</strong>, paste the service-account email above,
              and grant <em>View app information and download bulk reports</em> for your app.
            </p>
            <div className="space-y-2">
              <Label>Package name</Label>
              <Input value={pkg} onChange={e => setPkg(e.target.value)} placeholder="com.chinmaya.app" />
            </div>
            <div className="space-y-2">
              <Label>App name (optional)</Label>
              <Input value={appName} onChange={e => setAppName(e.target.value)} placeholder="Chinmaya Mission" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => link.mutate()} disabled={!pkg || link.isPending}>Link app</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
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
