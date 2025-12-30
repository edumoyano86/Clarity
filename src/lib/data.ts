import { Categoria, Gasto, Ingreso } from "./definitions";

let categorias: Categoria[] = [
  { id: '1', nombre: 'Vivienda', icono: 'Home', presupuesto: 1200 },
  { id: '2', nombre: 'Comida', icono: 'Utensils', presupuesto: 400 },
  { id: '3', nombre: 'Transporte', icono: 'Car', presupuesto: 150 },
  { id: '4', nombre: 'Entretenimiento', icono: 'Film', presupuesto: 100 },
  { id: '5', nombre: 'Salud', icono: 'HeartPulse', presupuesto: 200 },
];

let ingresos: Ingreso[] = [
    { id: '1', fuente: 'Salario', cantidad: 3000, fecha: new Date(new Date().setDate(1)).toISOString() },
    { id: '2', fuente: 'Freelance', cantidad: 500, fecha: new Date(new Date().setDate(15)).toISOString() },
];

let gastos: Gasto[] = [
    { id: '1', categoriaId: '1', cantidad: 950, fecha: new Date(new Date().setDate(2)).toISOString(), descripcion: 'Alquiler' },
    { id: '2', categoriaId: '2', cantidad: 80, fecha: new Date(new Date().setDate(3)).toISOString(), descripcion: 'Supermercado' },
    { id: '3', categoriaId: '3', cantidad: 50, fecha: new Date(new Date().setDate(5)).toISOString(), descripcion: 'Gasolina' },
    { id: '4', categoriaId: '2', cantidad: 45, fecha: new Date(new Date().setDate(10)).toISOString(), descripcion: 'Restaurante' },
    { id: '5', categoriaId: '4', cantidad: 30, fecha: new Date(new Date().setDate(12)).toISOString(), descripcion: 'Cine' },
];

// Functions to interact with the mock data
export const getMockCategorias = async (): Promise<Categoria[]> => {
  return Promise.resolve(categorias);
};

export const addMockCategoria = async (categoria: Omit<Categoria, 'id'>): Promise<Categoria> => {
  const nuevaCategoria = { ...categoria, id: (Math.random() * 1000).toString() };
  categorias.push(nuevaCategoria);
  return Promise.resolve(nuevaCategoria);
};

export const updateMockCategoria = async (categoria: Categoria): Promise<Categoria> => {
  categorias = categorias.map(c => c.id === categoria.id ? categoria : c);
  return Promise.resolve(categoria);
};


export const getMockIngresos = async (): Promise<Ingreso[]> => {
  return Promise.resolve(ingresos);
};

export const addMockIngreso = async (ingreso: Omit<Ingreso, 'id'>): Promise<Ingreso> => {
  const nuevoIngreso = { ...ingreso, id: (Math.random() * 1000).toString(), fecha: new Date(ingreso.fecha).toISOString() };
  ingresos.push(nuevoIngreso);
  return Promise.resolve(nuevoIngreso);
};

export const getMockGastos = async (): Promise<Gasto[]> => {
  return Promise.resolve(gastos);
};

export const addMockGasto = async (gasto: Omit<Gasto, 'id'>): Promise<Gasto> => {
  const nuevoGasto = { ...gasto, id: (Math.random() * 1000).toString(), fecha: new Date(gasto.fecha).toISOString() };
  gastos.push(nuevoGasto);
  return Promise.resolve(nuevoGasto);
};

export const getMockGastosByCategoria = async (categoriaId: string): Promise<Gasto[]> => {
    return Promise.resolve(gastos.filter(g => g.categoriaId === categoriaId));
}
