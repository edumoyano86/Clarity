
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Categoria, Transaction } from "@/lib/definitions";
import { ScrollArea } from "../ui/scroll-area";
import { Icon } from "../icons";

type RecentTransactionsProps = {
  transactions: Transaction[];
  categorias: Categoria[];
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

export function RecentTransactions({ transactions, categorias }: RecentTransactionsProps) {
  const getCategory = (id: string) => {
    return categorias.find(c => c.id === id);
  }

  const renderDescription = (tx: Transaction) => {
    let categoryName = '';
    if (tx.type === 'gasto' && tx.categoryId) {
        const category = getCategory(tx.categoryId);
        categoryName = category?.name || 'Gasto';
    } else if (tx.type === 'pago') {
        categoryName = 'Pago de Cuenta';
    }

    return {
      title: tx.description,
      subtitle: categoryName
    };
  };

  const getBadgeVariant = (type: Transaction['type']) => {
    switch (type) {
      case 'ingreso':
        return 'secondary';
      case 'gasto':
        return 'outline';
      case 'pago':
        return 'destructive';
      default:
        return 'default';
    }
  }

  const getAmountClass = (type: Transaction['type']) => {
    switch (type) {
        case 'ingreso': return 'text-green-600';
        case 'gasto': return 'text-destructive';
        case 'pago': return 'text-destructive';
        default: return '';
    }
  }

  const getAmountPrefix = (type: Transaction['type']) => {
      return type === 'ingreso' ? '+' : '-';
  }

  const getIcon = (tx: Transaction) => {
    if (tx.type === 'gasto' && tx.categoryId) {
        const category = getCategory(tx.categoryId);
        return category ? <Icon name={category.icono} className="h-5 w-5 text-muted-foreground" /> : null;
    }
    return null;
  }


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
                    <TableRow key={`${tx.type}-${tx.id}`}>
                      <TableCell>
                         <div className="flex items-center gap-2">
                            {getIcon(tx)}
                            <div>
                                <div className="font-medium">
                                {title}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                {new Date(tx.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                {subtitle && ` - ${subtitle}`}
                                </div>
                            </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={getBadgeVariant(tx.type)} className={getAmountClass(tx.type)}>
                           {getAmountPrefix(tx.type)} {formatCurrency(tx.amount)}
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
