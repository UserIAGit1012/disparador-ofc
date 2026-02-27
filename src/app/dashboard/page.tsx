import DashboardMetrics from "@/components/DashboardMetrics";

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Metricas e Custos</h2>
        <p className="text-muted-foreground">
          Acompanhe o volume de envios, taxa de erros e custos do WhatsApp Business API.
        </p>
      </div>
      <DashboardMetrics />
    </div>
  );
}
