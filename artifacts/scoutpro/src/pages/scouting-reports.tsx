import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, ArrowRight, Trash2, Shield } from "lucide-react";
import { scoutingReportsApi, type ScoutingReportListItem } from "@/lib/scouting-reports-api";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-muted text-muted-foreground" },
  in_progress: { label: "En progreso", cls: "bg-yellow-500/15 text-yellow-500" },
  finalized: { label: "Finalizado", cls: "bg-green-500/15 text-green-500" },
};

export default function ScoutingReports() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: reports, isLoading } = useQuery({
    queryKey: ["scouting-reports"],
    queryFn: () => scoutingReportsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scoutingReportsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scouting-reports"] });
      toast({ title: "Informe eliminado" });
    },
    onError: (e: Error) => toast({ title: "Error al eliminar", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl">Informes Pro</h1>
          <p className="text-muted-foreground">Informes de scouting profesionales con datos en vivo.</p>
        </div>
        <Link href="/scouting/reports/new">
          <Button className="font-display tracking-wide uppercase" data-testid="button-new-scouting-report">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Informe Pro
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !reports || reports.length === 0 ? (
        <Card className="border-dashed bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted p-3 rounded-full mb-4"><FileText className="h-6 w-6 text-muted-foreground" /></div>
            <h3 className="text-lg font-semibold">Sin informes pro</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Crea tu primer informe de scouting profesional.
            </p>
            <Link href="/scouting/reports/new">
              <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Crear informe</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r: ScoutingReportListItem) => {
            const status = STATUS_LABELS[r.status] ?? STATUS_LABELS["draft"]!;
            return (
              <Card key={r.id} className="hover:border-primary transition-all duration-200 group hover-elevate">
                <CardContent className="p-5 flex items-center gap-4">
                  <Link href={`/scouting/reports/${r.id}`} className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {r.opponentLogoUrl ? (
                        <img src={r.opponentLogoUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Shield className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold group-hover:text-primary transition-colors truncate" data-testid={`text-report-title-${r.id}`}>
                        {r.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {r.teamName && r.opponentName
                          ? `${r.teamName} vs ${r.opponentName}`
                          : (r.opponentName ?? r.teamName ?? "Sin equipos")}
                        {r.scoutName ? ` · ${r.scoutName}` : ""}
                        {" · "}
                        {new Date(r.updatedAt).toLocaleDateString("es-ES")}
                      </div>
                    </div>
                    <Badge className={`${status.cls} border-0 shrink-0`}>{status.label}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    data-testid={`button-delete-report-${r.id}`}
                    onClick={() => {
                      if (confirm(`¿Eliminar el informe "${r.title}"?`)) deleteMutation.mutate(r.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
