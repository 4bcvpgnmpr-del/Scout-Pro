import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { ScoutFlowLogo } from "@/components/logo";

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
          <div className="cursor-pointer">
            <ScoutFlowLogo size="md" />
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
      <div className="flex-1 w-full p-6 md:p-8">
        {children}
      </div>
    </div>
  );
}
