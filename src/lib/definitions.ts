

export type Categoria = {
  id: string;
  name: string;
  icono: string; 
  budget?: number;
};

export type Transaction = {
  id: string;
  type: 'ingreso' | 'gasto' | 'pago';
  amount: number;
  date: number; // timestamp
  description: string;
  categoryId?: string; // Solo para gastos
  accountId?: string; // Para pagos, el ID de la cuenta que salda
};

export type Account = {
    id: string;
    name: string;
    amount: number;
    dueDate: number; // timestamp
    status: 'pendiente' | 'pagada';
    paidAmount: number;
};

export type Appointment = {
  id: string;
  title: string;
  date: number; // timestamp
  notes?: string;
  userId: string;
};

export type Note = {
    id: string;
    title: string;
    content: string;
    createdAt: number; // timestamp
    updatedAt: number; // timestamp
};

export type Investment = {
    id: string;
    coinId: string;
    name: string;
    symbol: string;
    amount: number;
    purchasePrice: number;
    purchaseDate: number; // timestamp
};

// For CoinGecko API
export type CoinPrice = {
  [coinId: string]: {
    usd: number;
  };
};
