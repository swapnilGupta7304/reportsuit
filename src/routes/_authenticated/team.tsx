import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2, KeyRound, Pencil, Ban, CircleCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentProject } from "@/hooks/use-current-project";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  listOrgUsers,
  createOrgUser,
  updateOrgUser,
  changeOrgUserPassword,
  setOrgUserDisabled,
  deleteOrgUser,
} from "@/lib/user-management.functions";

export const Route = createFileRoute("/_authenticated/team")({
  component: () => <NoProjectGate><Inner /></NoProjectGate>,
});

type Member = {
  id: string;
  user_id: string;
  role: "admin" | "editor" | "viewer";
  email: string | null;
  display_name: string | null;
  last_sign_in_at: string | null;
  disabled: boolean;
};

function Inner() {
  const { user } = useAuth();
  const { currentProject } = useCurrentProject();
  const qc = useQueryClient();
  const orgId = currentProject!.organization_id;

  const listFn = useServerFn(listOrgUsers);
  const createFn = useServerFn(createOrgUser);
  const updateFn = useServerFn(updateOrgUser);
  const passwordFn = useServerFn(changeOrgUserPassword);
  const disableFn = useServerFn(setOrgUserDisabled);
  const deleteFn = useServerFn(deleteOrgUser);

  const { data, isLoading } = useQuery({
    queryKey: ["team", orgId],
    queryFn: () => listFn({ data: { orgId } }),
  });
  const members: Member[] = (data?.members as Member[]) ?? [];
  const myRole = members.find(m => m.user_id === user?.id)?.role;
  const isAdmin = myRole === "admin";

  const invalidate = () => qc.invalidateQueries({ queryKey: ["team", orgId] });

  // Create user
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ displayName: "", email: "", password: "", role: "viewer" as "admin" | "editor" | "viewer" });
  const createMut = useMutation({
    mutationFn: () => createFn({ data: { orgId, ...form } }),
    onSuccess: () => { toast.success("User created"); setCreateOpen(false); setForm({ displayName: "", email: "", password: "", role: "viewer" }); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Edit
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState({ displayName: "", email: "", role: "viewer" as "admin" | "editor" | "viewer" });
  const openEdit = (m: Member) => {
    setEditTarget(m);
    setEditForm({ displayName: m.display_name ?? "", email: m.email ?? "", role: m.role });
  };
  const editMut = useMutation({
    mutationFn: () => updateFn({ data: { orgId, userId: editTarget!.user_id, ...editForm } }),
    onSuccess: () => { toast.success("User updated"); setEditTarget(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Password
  const [pwTarget, setPwTarget] = useState<Member | null>(null);
  const [pwValue, setPwValue] = useState("");
  const pwMut = useMutation({
    mutationFn: () => passwordFn({ data: { orgId, userId: pwTarget!.user_id, password: pwValue } }),
    onSuccess: () => { toast.success("Password updated"); setPwTarget(null); setPwValue(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const disableMut = useMutation({
    mutationFn: (p: { userId: string; disabled: boolean }) => disableFn({ data: { orgId, ...p } }),
    onSuccess: (_d, v) => { toast.success(v.disabled ? "User disabled" : "User enabled"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { orgId, userId } }),
    onSuccess: () => { toast.success("User removed"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString() : "Never";

  return (
    <div className="space-y-6">
      <ModuleHeader title="Team & Roles" subtitle="Organization members" />

      {isAdmin && (
        <div className="rounded-2xl border bg-card p-6 shadow-card flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold flex items-center gap-2"><UserPlus className="size-4" />Create user</h3>
            <p className="text-xs text-muted-foreground mt-1">Add a user manually. They can sign in immediately with the email and password you set.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>Create user</Button>
        </div>
      )}

      <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
        {isLoading ? <Skeleton className="h-40 m-4" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(m => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">{m.display_name ?? m.email ?? m.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{m.role}</Badge></TableCell>
                  <TableCell>
                    {m.disabled
                      ? <Badge variant="destructive">Disabled</Badge>
                      : <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(m.last_sign_in_at)}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin && m.user_id !== user?.id ? (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(m)}><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" title="Change password" onClick={() => setPwTarget(m)}><KeyRound className="size-4" /></Button>
                        <Button size="icon" variant="ghost" title={m.disabled ? "Enable" : "Disable"} onClick={() => disableMut.mutate({ userId: m.user_id, disabled: !m.disabled })}>
                          {m.disabled ? <CircleCheck className="size-4" /> : <Ban className="size-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" title="Remove" onClick={() => { if (confirm("Remove this user from the organization?")) deleteMut.mutate(m.user_id); }}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Password</Label><Input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" /></div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!form.email || !form.password || form.password.length < 6 || createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={editForm.displayName} onChange={e => setEditForm({ ...editForm, displayName: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div>
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button disabled={editMut.isPending} onClick={() => editMut.mutate()}>{editMut.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password */}
      <Dialog open={!!pwTarget} onOpenChange={o => !o && setPwTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change password</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">For {pwTarget?.email}</div>
            <div><Label>New password</Label><Input type="text" value={pwValue} onChange={e => setPwValue(e.target.value)} placeholder="Min 6 characters" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwTarget(null)}>Cancel</Button>
            <Button disabled={pwValue.length < 6 || pwMut.isPending} onClick={() => pwMut.mutate()}>{pwMut.isPending ? "Updating..." : "Update password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
