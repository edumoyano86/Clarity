"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles } from "lucide-react";

const steps = [
  "Crea tus categorías de gasto",
  "Registra tus primeras transacciones",
  "Define metas de ahorro",
  "Activa alertas de presupuesto",
];

export function QuickStart() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("clarity-onboarding-completed");
    setVisible(!stored);
  }, []);

  const complete = () => {
    window.localStorage.setItem("clarity-onboarding-completed", "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <CardTitle>Primeros pasos</CardTitle>
        </div>
        <CardDescription>Tu app está lista para que empieces con cuatro pasos simples.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step) => (
          <div key={step} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>{step}</span>
          </div>
        ))}
        <Button onClick={complete} className="w-full">Entendido</Button>
      </CardContent>
    </Card>
  );
}
