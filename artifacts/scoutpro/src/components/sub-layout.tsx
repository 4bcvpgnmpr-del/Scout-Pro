import { Link } from "wouter";
import { Trophy, ArrowLeft } from "lucide-react";

interface SubLayoutProps {
  children: React.ReactNode;
  backTo: string;
  backLabel?: string;
}

export function SubLayout({ children, backTo, backLabel = "Volver" }: SubLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-sidebar border-b border-sidebar-border h-14 flex items-center px-6 gap-4 flex-shrink-0">
        <Link href="/">
          <div className="flex items-center gap-2 text-primary font-display text-xl tracking-widest cursor-pointer">
            <Trophy className="h-5 w-5" />
            SCOUTFLOW
          </div>
        </Link>
        <div className="w-px h-5 bg-sidebar-border" />
        <Link href={backTo}>
          <button className="flex items-center gap-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground transition text-sm font-medium">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
        </Link>
      </div>
      <div className="flex-1 p-8 max-w-3xl w-full mx-auto">
        {children}
      </div>
    </div>
  );
}
