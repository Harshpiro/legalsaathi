import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface Risk {
  clause: string;
  reason: string;
  severity: "high" | "medium" | "low" | string;
}

const severityStyle: Record<string, string> = {
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  low: "border-blue-500/40 bg-blue-500/10 text-blue-400",
};

export function RiskList({ risks }: { risks: Risk[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risky clauses ({risks.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {risks.length === 0 && (
          <p className="text-sm text-muted-foreground">Koi significant risk detect nahi hua.</p>
        )}
        {risks.map((r, i) => (
          <div
            key={i}
            className={`rounded-md border p-3 text-sm ${
              severityStyle[r.severity] || severityStyle.medium
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">Clause</span>
              <span className="text-xs uppercase tracking-wide">{r.severity}</span>
            </div>
            <p className="mt-1">{r.clause}</p>
            <div className="mt-2 text-xs opacity-80">
              <span className="font-semibold">Kyun risky: </span>
              {r.reason}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
