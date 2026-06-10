import { Link } from "wouter";
import { Trophy, ArrowLeft } from "lucide-react";

interface SubLayoutProps {
  children: React.ReactNode;
  backTo: string;
  backLabel?: string;
}

export function SubLayout({ children, backTo, backLabel = "Back" }: SubLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-900 h-14 flex items-center px-6 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-orange-500 font-black text-xl tracking-tighter">
          <Trophy className="h-5 w-5" />
          SCOUTPRO
        </div>
        <div className="w-px h-5 bg-gray-700" />
        <Link href={backTo}>
          <button className="flex items-center gap-1.5 text-gray-400 hover:text-white transition text-sm font-medium">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
        </Link>
      </div>
      {/* Content */}
      <div className="flex-1 p-8 max-w-3xl w-full mx-auto">
        {children}
      </div>
    </div>
  );
}
