import { Transaction, Account, Categoria } from '@/lib/definitions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Downloads tabular data as a CSV file.
 * Uses UTF-8 BOM and semicolon delimiters for seamless opening in Microsoft Excel and Google Sheets.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][]
) {
  const escapeCell = (val: string | number | undefined | null): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(';') || str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escapeCell).join(';'),
    ...rows.map((row) => (Array.isArray(row) ? row.map(escapeCell).join(';') : escapeCell(row))),
  ].join('\r\n');

  // \uFEFF is the UTF-8 Byte Order Mark, ensuring Excel displays accents and special characters
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports all transactions to a structured CSV file.
 */
export function exportTransactionsToCsv(
  transactions: Transaction[],
  categorias: Categoria[] = [],
  accounts: Account[] = []
) {
  const catMap = new Map<string, string>();
  categorias.forEach((c) => catMap.set(c.id, c.name));

  const accMap = new Map<string, string>();
  accounts.forEach((a) => accMap.set(a.id, a.name));

  const headers = [
    'Fecha',
    'Hora',
    'Tipo',
    'Descripción',
    'Monto',
    'Categoría',
    'Cuenta / Deuda Asociada',
  ];

  const rows = transactions
    .sort((a, b) => b.date - a.date)
    .map((t) => {
      const dateObj = new Date(t.date);
      const dateStr = format(dateObj, 'yyyy-MM-dd');
      const timeStr = format(dateObj, 'HH:mm');
      const typeStr =
        t.type === 'ingreso' ? 'Ingreso' : t.type === 'pago' ? 'Pago de Cuenta' : 'Gasto';
      const categoryName = (t.categoryId && catMap.get(t.categoryId)) || 'Sin categoría';
      const accountName = (t.accountId && accMap.get(t.accountId)) || '';

      return [dateStr, timeStr, typeStr, t.description || '', t.amount, categoryName, accountName];
    });

  const today = format(new Date(), 'yyyy-MM-dd');
  downloadCsv(`clarity_transacciones_${today}.csv`, headers, rows);
}

/**
 * Exports all accounts payable / debts to a structured CSV file.
 */
export function exportAccountsToCsv(
  accounts: Account[],
  paymentsMap?: Record<string, Transaction[]>
) {
  const now = Date.now();
  const headers = [
    'Nombre de la Cuenta',
    'Monto Total',
    'Monto Pagado',
    'Saldo Pendiente',
    'Progreso (%)',
    'Fecha de Vencimiento',
    'Estado',
    'Cantidad de Abonos',
  ];

  const rows = accounts.map((acc) => {
    const isPaid = acc.status === 'pagada' || acc.paidAmount >= acc.amount;
    const remaining = Math.max(0, acc.amount - acc.paidAmount);
    const progress = acc.amount > 0 ? ((acc.paidAmount / acc.amount) * 100).toFixed(1) : '0';
    const isOverdue = !isPaid && acc.dueDate < now;

    const statusStr = isPaid ? 'Saldada' : isOverdue ? 'Vencida' : 'Pendiente';
    const paymentsCount = paymentsMap && paymentsMap[acc.id] ? paymentsMap[acc.id].length : 0;
    const dueDateStr = format(new Date(acc.dueDate), 'yyyy-MM-dd');

    return [
      acc.name,
      acc.amount,
      acc.paidAmount,
      remaining,
      `${progress}%`,
      dueDateStr,
      statusStr,
      paymentsCount,
    ];
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  downloadCsv(`clarity_cuentas_por_pagar_${today}.csv`, headers, rows);
}
