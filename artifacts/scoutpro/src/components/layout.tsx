import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  BarChart3, 
  Users, 
  Shield, 
  Trophy, 
  ClipboardList, 
  Settings,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
    { name: "Players", href: "/players", icon: Users },
    { name: "Teams", href: "/teams", icon: Shield },
    { name: "Games", href: "/games", icon: Trophy },
    { name: "Reports", href: "/reports", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-primary font-display text-2xl tracking-wider">
          <Trophy className="h-6 w-6" />
          SCOUTPRO
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(!isMobileOpen)}>
          {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-sidebar z-40 p-4">
          <nav className="flex flex-col gap-2">
            {navigation.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href}>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`} onClick={() => setIsMobileOpen(false)}>
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0 left-0 bg-sidebar border-r border-sidebar-border">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 text-primary font-display text-3xl tracking-wider">
            <Trophy className="h-8 w-8" />
            SCOUTPRO
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="flex flex-col gap-1 px-3">
            {navigation.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href}>
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                    isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}>
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium tracking-wide uppercase font-display text-lg mt-1">{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 text-sidebar-foreground/70 text-sm">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 md:ml-64 mt-16 md:mt-0 flex flex-col">
        <main className="flex-1 p-6 md:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
