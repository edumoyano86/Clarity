'use server';

import { generateSavingsSuggestions } from '@/ai/flows/savings-suggestions';
import { Categoria, Gasto, Ingreso } from './definitions';
import { subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/firebase/server';

async function getCategorias(userId: string): Promise<Categoria[]> {
    const q = query(collection(db, "users", userId, "expenseCategories"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Categoria));
}

async function getIngresos(userId: string): Promise<Ingreso[]> {
    const q = query(collection(db, "users", userId, "incomes"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingreso));
}

async function getGastos(userId: string): Promise<Gasto[]> {
    const q = query(collection(db, "users", userId, "expenses"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gasto));
}


export type Periodo = 'mes_actual' | 'mes_pasado' | 'ultimos_3_meses' | 'ano_actual';

export async function getDashboardData(userId: string, periodo: Periodo = 'mes_actual') {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  switch (periodo) {
    case 'mes_actual':
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      break;
    case 'mes_pasado':
      startDate = startOfMonth(subMonths(now, 1));
      endDate = endOfMonth(subMonths(now, 1));
      break;
    case 'ultimos_3_meses':
      startDate = startOfMonth(subMonths(now, 2));
      endDate = endOfMonth(now);
      break;
    case 'ano_actual':
      startDate = startOfYear(now);
      endDate = endOfYear(now);
      break;
    default:
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
  }

  const [ingresos, gastos, categorias] = await Promise.all([
    getIngresos(userId),
    getGastos(userId),
    getCategorias(userId),
  ]);

  const filterByDate = (item: { date: number }) => {
    const itemDate = new Date(item.date);
    return itemDate >= startDate && itemDate <= endDate;
  };

  const ingresosFiltrados = ingresos.filter(filterByDate);
  const gastosFiltrados = gastos.filter(filterByDate);

  const totalIngresos = ingresosFiltrados.reduce((sum, i) => sum + i.amount, 0);
  const totalGastos = gastosFiltrados.reduce((sum, g) => sum + g.amount, 0);

  const gastosPorCategoria = categorias.map(cat => {
    const gastosEnCategoria = gastosFiltrados.filter(g => g.categoryId === cat.id);
    const total = gastosEnCategoria.reduce((sum, g) => sum + g.amount, 0);
    return {
      name: cat.name,
      total,
      icono: cat.icono,
    };
  }).filter(c => c.total > 0);

  const transaccionesRecientes = [
    ...ingresos.map(i => ({...i, tipo: 'ingreso' as const})),
    ...gastos.map(g => ({...g, tipo: 'gasto' as const}))
  ].sort((a, b) => b.date - a.date).slice(0, 5);

  return {
    totalIngresos,
    totalGastos,
    balance: totalIngresos - totalGastos,
    gastosPorCategoria,
    transaccionesRecientes,
    categorias,
  };
}

export async function getSavingsSuggestionsAction(userId: string) {
  const gastos = await getGastos(userId);
  const categorias = await getCategorias(userId);

  if (gastos.length === 0) {
    return { suggestions: ["No hay suficientes datos de gastos para generar sugerencias."] };
  }
  
  const spendingData = gastos.map(gasto => {
    const categoria = categorias.find(c => c.id === gasto.categoryId);
    return `${categoria?.name || 'Desconocido'}: $${gasto.amount}`;
  }).join(', ');

  try {
    const result = await generateSavingsSuggestions({
      spendingData: `Datos de gastos del usuario: ${spendingData}`
    });
    return result;
  } catch (error) {
    console.error("Error getting savings suggestions:", error);
    return { suggestions: ["Ocurrió un error al generar las sugerencias de ahorro."] };
  }
}
