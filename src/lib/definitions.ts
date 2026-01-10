

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
    id: string; // The main symbol, e.g. 'AAPL', 'BTC'
    assetType: 'crypto' | 'stock';
    name: string;
    symbol: string; // Same as ID
    amount: number;
    purchaseDate: number; // timestamp
    coinGeckoId?: string; // Only for crypto, e.g. 'bitcoin'
};

// For Price APIs
export type PriceData = {
  [symbolOrId: string]: {
    price: number;
  };
};

export type PortfolioDataPoint = {
    date: number;
    value: number;
};

// Map<asset symbol, Map<date string 'yyyy-MM-dd', price>>
export type PriceHistory = Map<string, Map<string, number>>;
