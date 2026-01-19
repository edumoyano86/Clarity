

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
    id: string; // The unique ID for the investment document in Firestore.
    assetType: 'crypto' | 'stock';
    name: string;
    symbol: string; // e.g., 'BTC', 'AAPL'
    amount: number;
    purchaseDate: number; // timestamp
    coinGeckoId?: string; // The unique ID from CoinGecko, e.g., 'bitcoin'. Required for cryptos.
};

// For Price APIs
export type PriceData = {
  [symbolOrId: string]: {
    price: number;
  };
};

export type PortfolioDataPoint = {
    date: number;
    value: number | null;
};

// Map<asset symbol or coinGeckoId, Map<date string 'yyyy-MM-dd', price>>
export type PriceHistory = Map<string, Map<string, number>>;
