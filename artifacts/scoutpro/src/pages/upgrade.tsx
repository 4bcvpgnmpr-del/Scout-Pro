import { Link } from "wouter";
import { Zap, Check } from "lucide-react";

export default function UpgradePage() {
  return (
    <div className="max-w-lg mx-auto p-6 space-y-6 text-center">
      <div className="flex flex-col items-center gap-2 pt-8">
        <div className="w-14 h-14 rounded-full bg-amber-900/30 border border-amber-700/40 flex items-center justify-center mb-2">
          <Zap size={24} className="text-amber-400" />
        </div>
        <h1 className="text-2xl font-medium">Plan Profesional</h1>
        <p className="text-zinc-500 text-sm">Desbloquea la sincronización automática de datos</p>
      </div>

      <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/40 p-6 text-left space-y-3">
        {[
          "Sincronización automática FEB, EuroLeague y EuroCup",
          "Estadísticas actualizadas cada 2-6 horas",
          "Acceso a ligas automatizadas en Seleccionar Equipo",
          "Dashboard de estadísticas avanzadas",
        ].map((feature) => (
          <div key={feature} className="flex items-start gap-2.5">
            <Check size={15} className="text-green-400 mt-0.5 shrink-0" />
            <span className="text-sm text-zinc-300">{feature}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
          Próximamente — Contacta con ventas
        </button>
        <Link href="/" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
