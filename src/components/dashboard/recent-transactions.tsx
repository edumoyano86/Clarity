import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Categoria, Gasto, Ingreso } from "@/lib/definitions";

type Transaction = (Ingreso & { tipo: 'ingreso' }) | (Gasto & { tipo: 'gasto' });

type RecentTransactionsProps = {
  transactions: Transaction[];
  categorias: Categoria[];
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

export function RecentTransactions({ transactions, categorias }: RecentTransactionsProps) {
  const getCategoryName = (id: string) => {
    return categorias.find(c => c.id === id)?.name || "Desconocido";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimas 5 Transacciones</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="hidden md:table-cell">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={`${tx.tipo}-${tx.id}`}>
                <TableCell>
                  <div className="font-medium">
                    {tx.tipo === 'ingreso' ? tx.source : (tx.notes || getCategoryName(tx.categoryId))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {tx.tipo === 'ingreso' ? 'Ingreso' : getCategoryName(tx.categoryId)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={tx.tipo === 'ingreso' ? 'secondary' : 'outline'} className={tx.tipo === 'ingreso' ? "text-green-600" : ""}>
                    {tx.tipo === 'ingreso' ? '+' : '-'} {formatCurrency(tx.amount)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {new Date(tx.date).toLocaleDateString('es-ES')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
