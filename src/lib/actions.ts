'use server';

import { revalidatePath } from 'next/cache';
import { generateSavingsSuggestions } from '@/ai/flows/savings-suggestions';
import { Categoria, Gasto, Ingreso } from './definitions';
import { subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { getCategorias, getIngresos, getGastos, addGasto as addGastoToDb, addIngreso as addIngresoToDb, saveCategoria as saveCategoriaToDb } from './firebase-actions';
import { generateBudgetAlert } from '@/ai/flows/budget-alerts';
import { z } from 'zod';

export type Periodo = 'mes_actual' | 'mes_pasado' | 'ultimos_3_meses' | 'ano_actual';

const CategoriaSchema = z.object({
  id: z.string().optional().or(z.literal('')),
  nombre: z.string().min(1, 'El nombre es requerido'),
  icono: z.string().min(1, 'El icono es requerido'),
  presupuesto: z.coerce.number().min(0, 'El presupuesto debe ser un número positivo').optional(),
});

const IngresoSchema = z.object({
  fuente: z.string().min(1, 'La fuente es requerida'),
  cantidad: z.coerce.number().positive('La cantidad debe ser un número positivo'),
  fecha: z.string().min(1, 'La fecha es requerida'),
});

const GastoSchema = z.object({
  descripcion: z.string().optional(),
  cantidad: z.coerce.number().positive('La cantidad debe ser un número positivo'),
  categoriaId: z.string().min(1, 'La categoría es requerida'),
  fecha: z.string().min(1, 'La fecha es requerida'),
});

type FormState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[] | undefined>;
    alertMessage?: string;
};

export async function saveCategoria(formData: FormData): Promise<FormState | undefined> {
    const data = Object.fromEntries(formData.entries());
    const validatedFields = CategoriaSchema.safeParse(data);
    
    if (!validatedFields.success) {
        return {
            success: false,
            message: 'Error de validación: ' + validatedFields.error.flatten().fieldErrors.nombre,
        };
    }

    try {
        await saveCategoriaToDb(validatedFields.data);
        revalidatePath('/categorias');
        return { success: true, message: 'Categoría guardada exitosamente.' };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
        return { success: false, message: `Error al guardar la categoría: ${errorMessage}` };
    }
}

export async function addIngreso(formData: FormData): Promise<FormState | undefined> {
    const data = Object.fromEntries(formData.entries());
    const validatedFields = IngresoSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            success: false,
            message: 'Error de validación: ' + JSON.stringify(validatedFields.error.flatten().fieldErrors),
        };
    }
    
    try {
        await addIngresoToDb(validatedFields.data);
        revalidatePath('/ingresos');
        revalidatePath('/');
        return { success: true, message: 'Ingreso agregado exitosamente.' };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
        return { success: false, message: `Error al agregar el ingreso: ${errorMessage}` };
    }
}

export async function addGasto(formData: FormData): Promise<FormState | undefined> {
    const data = Object.fromEntries(formData.entries());
    const validatedFields = GastoSchema.safeParse(data);

    if (!validatedFields.success) {
         return {
            success: false,
            message: 'Error de validación: ' + JSON.stringify(validatedFields.error.flatten().fieldErrors),
        };
    }
    
    try {
        const alertMessage = await addGastoToDb(validatedFields.data);
        revalidatePath('/gastos');
        revalidatePath('/');
        return { success: true, message: 'Gasto agregado exitosamente.', alertMessage };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
        return { success: false, message: `Error al agregar el gasto: ${errorMessage}` };
    }
}


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
    revalidatePath('/');
    return result;
  } catch (error) {
    console.error("Error getting savings suggestions:", error);
    return { suggestions: ["Ocurrió un error al generar las sugerencias de ahorro."] };
  }
}
