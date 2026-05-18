import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Globe, Smartphone, Layers, Archive, Trash2, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/projects")({ component: Page });

const typeIcon = { website: Globe, app: Smartphone, both: Layers } as const;

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: orgs } = useQuery({
    queryKey: ["my-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(id, name)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, organizations(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState<{ name: string; project_type: "website" | "app" | "both"; website_url: string; description: string; organization_id: string }>({ name: "", project_type: "website", website_url: "", description: "", organization_id: "" });

  const create = useMutation({
    mutationFn: async () => {
      const orgId = form.organization_id || orgs?.[0]?.organization_id;
      if (!orgId) throw new Error("No organization");
      const { error } = await supabase.from("projects").insert({
        name: form.name,
        project_type: form.project_type,
        website_url: form.website_url || null,
        description: form.description || null,
        organization_id: orgId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project created");
      setOpen(false);
      setForm({ name: "", project_type: "website", website_url: "", description: "", organization_id: "" });
      qc.invalidateQueries({ queryKey: ["projects-page"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "archived" }) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects-page"] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["projects-page"] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage websites and mobile apps you track.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Add project</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Chinmaya Mission" /></div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.project_type} onValueChange={(v: "website" | "app" | "both") => setForm({ ...form, project_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="app">Mobile App</SelectItem>
                    <SelectItem value="both">Website + App</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {orgs && orgs.length > 1 && (
                <div className="space-y-2"><Label>Organization</Label>
                  <Select value={form.organization_id || orgs[0].organization_id} onValueChange={(v) => setForm({ ...form, organization_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {orgs.map(o => <SelectItem key={o.organization_id} value={o.organization_id}>{(o.organizations as { name: string } | null)?.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2"><Label>Website URL</Label><Input value={form.website_url} onChange={e => setForm({ ...form, website_url: e.target.value })} placeholder="https://" /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => {
            const Icon = typeIcon[p.project_type as keyof typeof typeIcon];
            return (
              <div key={p.id} className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between">
                  <div className="size-10 rounded-xl bg-primary-soft text-primary grid place-items-center"><Icon className="size-5" /></div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => archive.mutate({ id: p.id, status: p.status === "archived" ? "active" : "archived" })}><Archive className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this project?")) remove.mutate(p.id); }}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
                <h3 className="font-display font-semibold mt-3">{p.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{p.project_type} · {p.status}</p>
                {p.website_url && <a href={p.website_url} target="_blank" rel="noreferrer" className="text-xs text-primary mt-2 inline-block truncate max-w-full">{p.website_url}</a>}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={FolderKanban} title="No projects yet" description="Add your first website or mobile app to start tracking analytics." actionLabel="Add project" onAction={() => setOpen(true)} />
      )}
    </div>
  );
}
