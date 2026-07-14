"use client";

import { AlertTriangle, CheckCircle2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface BudgetAlert {
  categoryName: string;
  spent: number;
  budget: number;
  percentage: number;
  status: "warning" | "danger";
  remaining: number;
}

type BudgetAlertsProps = {
  alerts: BudgetAlert[];
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);

export function BudgetAlerts({ alerts }: BudgetAlertsProps) {
  if (!alerts.length) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <CardTitle>Alertas de presupuesto</CardTitle>
          </div>
          <CardDescription>No hay categorías cerca del límite en este período.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Tu presupuesto está bajo control.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <CardTitle>Alertas de presupuesto</CardTitle>
          </div>
          <Badge variant="destructive">{alerts.length}</Badge>
        </div>
        <CardDescription>Estas categorías ya están cerca o superaron su límite.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.map((alert) => (
          <div key={alert.categoryName} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{alert.categoryName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(alert.spent)} de {formatCurrency(alert.budget)}
                </p>
              </div>
              <Badge variant={alert.status === "danger" ? "destructive" : "secondary"}>
                {alert.status === "danger" ? "Superado" : "Cerca del límite"}
              </Badge>
            </div>
            <Progress value={Math.min(100, alert.percentage)} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(alert.percentage)}% del presupuesto usado</span>
              <span>{formatCurrency(alert.remaining)} restante</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
