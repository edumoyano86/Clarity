"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload } from "lucide-react";

export function DataImportExport() {
  const inputRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const rows = [
      ["description", "amount", "type", "date"],
      ["Ejemplo", "1500", "gasto", "2026-07-10"],
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clarity-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar / Exportar datos</CardTitle>
        <CardDescription>Exporta tus datos para respaldarlos o importarlos desde un archivo CSV.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={exportCsv} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Button onClick={() => inputRef.current?.click()} variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importar CSV
        </Button>
        <input ref={inputRef} type="file" accept=".csv" className="hidden" />
      </CardContent>
    </Card>
  );
}
