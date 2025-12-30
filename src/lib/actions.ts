
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { generateBudgetAlert } from '@/ai/flows/budget-alerts';
import { generateSavingsSuggestions } from '@/ai/flows/savings-suggestions';
import { addMockCategoria, addMockGasto, addMockIngreso, getMockCategorias, getMockGastos, getMockGastosByCategoria, getMockIngresos, updateMockCategoria } from './data';
import { Categoria, Gasto, Ingreso } from './definitions';
import { subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears } from 'date-fns';

export type Periodo = 'mes_actual' | 'mes_pasado' | 'ultimos_3_meses' | 'ano_actual';

// Schema for category form
const CategoriaSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre es requerido'),
  icono: z.string().min(1, 'El icono es requerido'),
  presupuesto: z.coerce.number().min(0, 'El presupuesto debe ser un número positivo').optional(),
});

export async function saveCategoria(prevState: any, formData: FormData) {
  const validatedFields = CategoriaSchema.safeParse({
    id: formData.get('id') || undefined,
    nombre: formData.get('nombre'),
    icono: formData.get('icono'),
    presupuesto: formData.get('presupuesto'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Error de validación.',
    };
  }

  try {
    if (validatedFields.data.id) {
      await updateMockCategoria(validatedFields.data as Categoria);
    } else {
      await addMockCategoria(validatedFields.data);
    }
    revalidatePath('/categorias');
    revalidatePath('/');
    return { message: 'Categoría guardada exitosamente.', success: true };
  } catch (e) {
    return { message: 'Error al guardar la categoría.' };
  }
}

// Schema for income form
const IngresoSchema = z.object({
  fuente: z.string().min(1, 'La fuente es requerida'),
  cantidad: z.coerce.number().positive('La cantidad debe ser un número positivo'),
  fecha: z.string().min(1, 'La fecha es requerida'),
});

export async function addIngreso(prevState: any, formData: FormData) {
  const validatedFields = IngresoSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Error de validación.',
    };
  }
  
  try {
    await addMockIngreso(validatedFields.data);
    revalidatePath('/ingresos');
    revalidatePath('/');
    return { message: 'Ingreso agregado exitosamente.', success: true };
  } catch (e) {
    return { message: 'Error al agregar el ingreso.' };
  }
}

// Schema for expense form
const GastoSchema = z.object({
  descripcion: z.string().optional(),
  cantidad: z.coerce.number().positive('La cantidad debe ser un número positivo'),
  categoriaId: z.string().min(1, 'La categoría es requerida'),
  fecha: z.string().min(1, 'La fecha es requerida'),
});

export async function addGasto(prevState: any, formData: FormData) {
  const validatedFields = GastoSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Error de validación.',
    };
  }

  let alertMessage: string | undefined = undefined;

  try {
    await addMockGasto(validatedFields.data);
    revalidatePath('/gastos');
    revalidatePath('/');
    
    // Check for budget alert
    const categorias = await getCategorias();
    const categoria = categorias.find(c => c.id === validatedFields.data.categoriaId);
    if (categoria && categoria.presupuesto && categoria.presupuesto > 0) {
      const gastosCategoria = await getMockGastosByCategoria(categoria.id);
      const totalGastado = gastosCategoria.reduce((sum, g) => sum + g.cantidad, 0);

      if (totalGastado > categoria.presupuesto) {
        const alertResult = await generateBudgetAlert({
          category: categoria.nombre,
          spentAmount: totalGastado,
          budgetLimit: categoria.presupuesto,
          userName: "Usuario",
        });
        alertMessage = alertResult.alertMessage;
      }
    }

    return { message: 'Gasto agregado exitosamente.', success: true, alertMessage };
  } catch (e) {
    return { message: 'Error al agregar el gasto.' };
  }
}


export async function getCategorias(): Promise<Categoria[]> {
  return await getMockCategorias();
}

export async function getIngresos(): Promise<Ingreso[]> {
  return await getMockIngresos();
}

export async function getGastos(): Promise<Gasto[]> {
  return await getMockGastos();
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

  const filterByDate = (item: { fecha: string }) => {
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
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 5);

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
    return result;
  } catch (error) {
    console.error("Error getting savings suggestions:", error);
    return { suggestions: ["Ocurrió un error al generar las sugerencias de ahorro."] };
  }
}
