import DispatchHistory from "@/components/DispatchHistory";

export default function DisparosPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Historico de Disparos</h2>
        <p className="text-muted-foreground">
          Visualize todos os disparos realizados e seus status.
        </p>
      </div>
      <DispatchHistory />
    </div>
  );
}
