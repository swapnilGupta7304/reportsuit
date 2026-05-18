import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentProject } from "@/hooks/use-current-project";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/team")({ component: () => <NoProjectGate><Inner /></NoProjectGate> });

function Inner() {
  const { user } = useAuth();
  const { currentProject } = useCurrentProject();
  const qc = useQueryClient();
  const orgId = currentProject!.organization_id;

  const { data, isLoading } = useQuery({
    queryKey: ["team", orgId],
    queryFn: async () => {
      const { data: members } = await supabase.from("organization_members").select("*").eq("organization_id", orgId);
      if (!members?.length) return [];
      const ids = members.map(m => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, email, display_name").in("id", ids);
      return members.map(m => ({ ...m, profile: profiles?.find(p => p.id === m.user_id) }));
    },
  });

  const myRole = data?.find(m => m.user_id === user?.id)?.role;
  const isAdmin = myRole === "admin";

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("organization_members").update({ role: role as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["team"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("organization_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Member removed"); qc.invalidateQueries({ queryKey: ["team"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const invite = () => {
    toast.info(`Invitation flow requires email service. Share the signup link with ${inviteEmail || "the user"} — once they register, an admin can add them here.`);
  };

  return (
    <div className="space-y-6">
      <ModuleHeader title="Team & Roles" subtitle="Organization members" />
      {isAdmin && (
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><UserPlus className="size-4" />Invite teammate</h3>
          <div className="flex gap-2">
            <Input placeholder="email@org.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <Button onClick={invite}>Send invite</Button>
          </div>
        </div>
      )}
      <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
        {isLoading ? <Skeleton className="h-40 m-4" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.map(m => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">{m.profile?.display_name ?? m.profile?.email ?? m.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                  </TableCell>
                  <TableCell>
                    {isAdmin && m.user_id !== user?.id ? (
                      <Select defaultValue={m.role} onValueChange={v => updateRole.mutate({ id: m.id, role: v })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : <Badge variant="secondary" className="capitalize">{m.role}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && m.user_id !== user?.id && (
                      <Button size="icon" variant="ghost" onClick={() => removeMember.mutate(m.id)}><Trash2 className="size-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
