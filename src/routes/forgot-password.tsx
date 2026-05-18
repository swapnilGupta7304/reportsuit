import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({ component: Page });

function Page() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) toast.error(error.message); else toast.success("Check your email for the reset link.");
  };
  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="font-display text-2xl font-semibold">Reset password</h2>
        <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        <Button type="submit" className="w-full" disabled={loading}>Send reset link</Button>
        <Link to="/login" className="text-sm text-primary hover:underline block text-center">Back to sign in</Link>
      </form>
    </div>
  );
}
