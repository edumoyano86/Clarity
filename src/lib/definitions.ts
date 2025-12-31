
export type Categoria = {
  id: string;
  name: string;
  icono: string; 
  budget?: number;
};

export type Ingreso = {
  id: string;
  source: string;
  amount: number;
  date: number; // timestamp
};

export type Gasto = {
  id: string;
  amount: number;
  categoryId: string;
  date: number; // timestamp
  notes?: string;
};
