
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Categoria, Gasto, Ingreso } from "@/lib/definitions";
import { ScrollArea } from "../ui/scroll-area";

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

  const renderDescription = (tx: Transaction) => {
    if (tx.tipo === 'ingreso') {
      return {
        title: tx.source,
        subtitle: 'Ingreso'
      };
    }
    // It's a Gasto (expense)
    const categoryName = getCategoryName(tx.categoryId);
    return {
      title: tx.notes || categoryName,
      subtitle: categoryName
    };
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimas 5 Transacciones</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length > 0 ? (
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const { title, subtitle } = renderDescription(tx);
                  return (
                    <TableRow key={`${tx.tipo}-${tx.id}`}>
                      <TableCell>
                        <div className="font-medium">
                          {title}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(tx.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          {' - '}
                          {subtitle}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={tx.tipo === 'ingreso' ? 'secondary' : 'outline'} className={tx.tipo === 'ingreso' ? "text-green-600" : ""}>
                          {tx.tipo === 'ingreso' ? '+' : '-'} {formatCurrency(tx.amount)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <p className="text-muted-foreground text-center py-4">No hay transacciones recientes.</p>
        )}
      </CardContent>
    </Card>
  );
}
