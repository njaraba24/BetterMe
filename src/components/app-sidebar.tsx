import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LayoutDashboard, CheckSquare, Target, Wallet, BookText, Repeat, LogOut, Moon, Sun, Users, Search, CalendarDays, Handshake, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { getSeenSharedIds, subscribeSharedSeen } from "@/lib/seen-shares";

const items: Array<{ to: "/" | "/week" | "/habits" | "/tasks" | "/goals" | "/finance" | "/journal" | "/search" | "/friends" | "/accountability"; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/week", label: "This week", icon: CalendarDays },
  { to: "/search", label: "Search", icon: Search },
  { to: "/habits", label: "Habits", icon: Repeat },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/journal", label: "Journal", icon: BookText },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/accountability", label: "Accountability", icon: Handshake },
];

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["friendships-pending"],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("addressee_id", user!.id);
      return count ?? 0;
    },
    refetchInterval: 20000,
  });

  const { data: sharedIds = [] } = useQuery({
    queryKey: ["shared-with-me-ids"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_shares")
        .select("page_id")
        .eq("shared_with_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.page_id as string);
    },
    refetchInterval: 20000,
  });

  const [seenTick, setSeenTick] = useState(0);
  useEffect(() => subscribeSharedSeen(() => setSeenTick((n) => n + 1)), []);
  const seen = getSeenSharedIds();
  const unseenShared = sharedIds.filter((id) => !seen.has(id)).length;
  void seenTick;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-5">
        <h1 className="text-sm font-semibold tracking-tight">Better Me</h1>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {items.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                active ? "bg-sidebar-accent font-medium" : "hover:bg-sidebar-accent/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{it.label}</span>
              {it.to === "/friends" && pendingCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {pendingCount}
                </span>
              )}
              {it.to === "/journal" && unseenShared > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {unseenShared}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-2 space-y-0.5">
        <button
          onClick={toggle}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <div className="px-2 pt-2 text-xs text-muted-foreground truncate" title={user?.email ?? ""}>{user?.email}</div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex h-screen w-[220px] shrink-0 border-r sticky top-0">
      <SidebarInner />
    </aside>
  );
}

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 backdrop-blur px-3 py-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="rounded-md p-2 hover:bg-muted" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarInner onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <span className="text-sm font-semibold">Better Me</span>
    </div>
  );
}
