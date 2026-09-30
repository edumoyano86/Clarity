'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { Transaction, Categoria, Account } from '@/lib/definitions';
import { exportTransactionsToCsv } from '@/lib/export-utils';
import { useToast } from '@/hooks/use-toast';

interface DataImportExportProps {
  transactions?: Transaction[];
  categorias?: Categoria[];
  accounts?: Account[];
}

export function DataImportExport({
  transactions = [],
  categorias = [],
  accounts = [],
}: DataImportExportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExportCsv = () => {
    if (transactions.length === 0) {
      toast({
        title: 'Sin datos',
        description: 'No hay transacciones registradas para exportar.',
      });
      return;
    }

    exportTransactionsToCsv(transactions, categorias, accounts);
    toast({
      title: 'Reporte generado',
      description: `Se descargó el archivo CSV con ${transactions.length} transacciones para Excel.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Respaldo y Reportes</CardTitle>
        </div>
        <CardDescription>
          Descarga tus transacciones en formato CSV compatible directamente con Microsoft Excel y Google Sheets.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={handleExportCsv} variant="outline" className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Exportar Transacciones (CSV)
        </Button>
      </CardContent>
    </Card>
  );
}
