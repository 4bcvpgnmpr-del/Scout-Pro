import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Shield, Users, Trophy, FileText, Calendar,
  Star, Video, BookOpen, UserCog, Settings, Menu, X, Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navGroups = [
  {
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Gestión",
    items: [
      { name: "Equipos", href: "/equipos", icon: Shield },
      { name: "Jugadores", href: "/jugadores", icon: Users },
      { name: "Fichajes", href: "/fichajes", icon: Star },
      { name: "Vista Scouting", href: "/scout", icon: Swords },
    ],
  },
  {
    label: "Contenido",
    items: [
      { name: "Vídeos", href: "/videos", icon: Video },
      { name: "Biblioteca", href: "/jugadas", icon: BookOpen },
    ],
  },
  {
    label: "Planificación",
    items: [
      { name: "Partidos", href: "/games", icon: Trophy },
      { name: "Calendario", href: "/calendar", icon: Calendar },
    ],
  },
  {
    label: "Análisis",
    items: [
      { name: "Informes", href: "/reports", icon: FileText },
    ],
  },
  {
    label: "Admin",
    items: [
      { name: "Usuarios", href: "/usuarios", icon: UserCog },
      { name: "Ajustes", href: "/ajustes", icon: Settings },
    ],
  },
];

function NavItem({
  item,
  location,
  onClick,
}: {
  item: { name: string; href: string; icon: React.ElementType; exact?: boolean };
  location: string;
  onClick?: () => void;
}) {
  const isActive = item.exact ? location === item.href : location.startsWith(item.href);
  return (
    <Link href={item.href}>
      <div
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all cursor-pointer select-none ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        }`}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">{item.name}</span>
      </div>
    </Link>
  );
}

function SidebarContent({ location, onNavClick }: { location: string; onNavClick?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-14 flex items-center px-5 border-b border-sidebar-border shrink-0">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <Trophy className="h-6 w-6 text-primary" />
            <span className="font-display text-xl tracking-widest text-primary">SCOUTPRO</span>
          </div>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && (
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">
                {group.label}
              </div>
            )}
            <div className="px-2 space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.href} item={item} location={location} onClick={onNavClick} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="h-14 flex items-center px-5 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">E</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">Entrenador</div>
            <div className="text-[10px] text-sidebar-foreground/50 truncate">Club Baloncesto</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-display text-lg tracking-widest text-primary">SCOUTPRO</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 bg-sidebar z-40 overflow-y-auto">
          <SidebarContent location={location} onNavClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="hidden md:flex w-52 flex-col fixed inset-y-0 left-0 bg-sidebar border-r border-sidebar-border z-30">
        <SidebarContent location={location} />
      </div>

      <div className="flex-1 md:ml-52 mt-14 md:mt-0">
        <main className="min-h-screen p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
