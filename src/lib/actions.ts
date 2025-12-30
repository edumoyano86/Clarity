
'use server';

import { revalidatePath } from 'next/cache';
import { generateSavingsSuggestions } from '@/ai/flows/savings-suggestions';
import { Categoria, Gasto, Ingreso } from './definitions';
import { subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO } from 'date-fns';
import { getCategorias, getIngresos, getGastos } from './firebase-actions';

export type Periodo = 'mes_actual' | 'mes_pasado' | 'ultimos_3_meses' | 'ano_actual';

// Note: Form submission actions have been moved to client-side actions in `src/lib/client-actions.ts`
// to resolve persistent server response errors. The data fetching functions remain here.

export async function getDashboardData(periodo: Periodo = 'mes_actual') {
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
    getIngresos(),
    getGastos(),
    getCategorias(),
  ]);

  const filterByDate = (item: { fecha: number }) => {
    const itemDate = new Date(item.fecha);
    return itemDate >= startDate && itemDate <= endDate;
  };

  const ingresosFiltrados = ingresos.filter(filterByDate);
  const gastosFiltrados = gastos.filter(filterByDate);

  const totalIngresos = ingresosFiltrados.reduce((sum, i) => sum + i.cantidad, 0);
  const totalGastos = gastosFiltrados.reduce((sum, g) => sum + g.cantidad, 0);

  const gastosPorCategoria = categorias.map(cat => {
    const gastosEnCategoria = gastosFiltrados.filter(g => g.categoriaId === cat.id);
    const total = gastosEnCategoria.reduce((sum, g) => sum + g.cantidad, 0);
    return {
      name: cat.nombre,
      total,
      icono: cat.icono,
    };
  }).filter(c => c.total > 0);

  const transaccionesRecientes = [
    ...ingresos.map(i => ({...i, tipo: 'ingreso' as const})),
    ...gastos.map(g => ({...g, tipo: 'gasto' as const}))
  ].sort((a, b) => b.fecha - a.fecha).slice(0, 5);

  return {
    totalIngresos,
    totalGastos,
    balance: totalIngresos - totalGastos,
    gastosPorCategoria,
    transaccionesRecientes
  };
}

export async function getSavingsSuggestionsAction() {
  const gastos = await getGastos();
  const categorias = await getCategorias();

  if (gastos.length === 0) {
    return { suggestions: ["No hay suficientes datos de gastos para generar sugerencias."] };
  }
  
  const spendingData = gastos.map(gasto => {
    const categoria = categorias.find(c => c.id === gasto.categoriaId);
    return `${categoria?.nombre || 'Desconocido'}: $${gasto.cantidad}`;
  }).join(', ');

  try {
    const result = await generateSavingsSuggestions({
      spendingData: `Datos de gastos del usuario: ${spendingData}`
    });
    // This action needs to revalidate paths if data it depends on changes.
    revalidatePath('/');
    return result;
  } catch (error) {
    console.error("Error getting savings suggestions:", error);
    return { suggestions: ["Ocurrió un error al generar las sugerencias de ahorro."] };
  }
}
