import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({ component: Page });

function Page() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); nav({ to: "/dashboard" }); }
  };
  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="font-display text-2xl font-semibold">Set a new password</h2>
        <div className="space-y-2"><Label>New password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></div>
        <Button type="submit" className="w-full" disabled={loading}>Update password</Button>
      </form>
    </div>
  );
}
