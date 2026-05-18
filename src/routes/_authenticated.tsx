import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Globe, BarChart3, FileText, Smartphone, MapPin,
  MonitorSmartphone, MousePointerClick, Sparkles, Settings, Users,
  FolderKanban, LogOut, Sparkle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjectProvider } from "@/hooks/use-current-project";
import { DateRangeProvider } from "@/hooks/use-date-range";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { DateRangePicker } from "@/components/DateRangePicker";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: Layout,
});

const nav = [
  { to: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
  { to: "/website", label: "Website Analytics", icon: Globe },
  { to: "/traffic-sources", label: "Traffic Sources", icon: BarChart3 },
  { to: "/top-pages", label: "Top Pages", icon: FileText },
  { to: "/devices", label: "Devices", icon: MonitorSmartphone },
  { to: "/geography", label: "Geography", icon: MapPin },
  { to: "/events", label: "Top Events", icon: MousePointerClick },
  { to: "/app-analytics", label: "App Analytics", icon: Smartphone },
  { to: "/insights", label: "Executive Insights", icon: Sparkle },
  { to: "/reports", label: "Reports", icon: FileText },
] as const;

const secondary = [
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/team", label: "Team & Roles", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function Layout() {
  const { user } = useAuth();
  const nav2 = useNavigate();
  const loc = useLocation();

  return (
    <ProjectProvider>
      <DateRangeProvider>
        <div className="min-h-screen flex bg-background">
          <aside className="w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground hidden lg:flex flex-col">
            <div className="h-16 flex items-center gap-2 px-5 border-b">
              <div className="size-9 rounded-lg gradient-primary grid place-items-center text-primary-foreground"><Sparkles className="size-4" /></div>
              <div>
                <div className="font-display font-semibold text-sm leading-none">Chinmaya</div>
                <div className="text-[10px] text-muted-foreground mt-1">Report Suite</div>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {nav.map(item => {
                const active = loc.pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/60"
                  )}>
                    <Icon className="size-4" />{item.label}
                  </Link>
                );
              })}
              <div className="pt-4 mt-4 border-t space-y-0.5">
                {secondary.map(item => {
                  const active = loc.pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to} className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/60"
                    )}>
                      <Icon className="size-4" />{item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
            <div className="p-3 border-t flex items-center gap-3">
              <Avatar className="size-8"><AvatarFallback className="bg-primary-soft text-primary text-xs">{user?.email?.[0]?.toUpperCase() ?? "U"}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{user?.email}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={async () => { await supabase.auth.signOut(); nav2({ to: "/login" }); }}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-16 border-b bg-card/80 backdrop-blur sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-6">
              <ProjectSwitcher />
              <div className="flex-1" />
              <DateRangePicker />
            </header>
            <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
              <Outlet />
            </main>
          </div>
        </div>
      </DateRangeProvider>
    </ProjectProvider>
  );
}
