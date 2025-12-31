'use server';

import { revalidatePath } from 'next/cache';
import { generateSavingsSuggestions } from '@/ai/flows/savings-suggestions';
import { Categoria, Gasto, Ingreso } from './definitions';
import { subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { z } from 'zod';
import { getDocs, collection, query, where, getDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/server';
import { parseISO } from 'date-fns';
import { generateBudgetAlert } from '@/ai/flows/budget-alerts';

export type ActionState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[] | undefined>;
    alertMessage?: string;
};

const CategoriaSchema = z.object({
  id: z.string().optional().or(z.literal('')),
  name: z.string({ required_error: 'El nombre es requerido.'}).min(1, 'El nombre es requerido'),
  icono: z.string({ required_error: 'El icono es requerido.'}).min(1, 'El icono es requerido'),
  budget: z.coerce.number().min(0, 'El presupuesto debe ser un número positivo').optional().or(z.literal('')),
});

const IngresoSchema = z.object({
  source: z.string({ required_error: 'La fuente es requerida.'}).min(1, 'La fuente es requerida'),
  amount: z.coerce.number({ invalid_type_error: 'La cantidad debe ser un número.'}).positive('La cantidad debe ser un número positivo'),
  date: z.string({ required_error: 'La fecha es requerida.'}).min(1, 'La fecha es requerida'),
});

const GastoSchema = z.object({
  notes: z.string().optional(),
  amount: z.coerce.number({ invalid_type_error: 'La cantidad debe ser un número.'}).positive('La cantidad debe ser un número positivo'),
  categoryId: z.string({ required_error: 'La categoría es requerida.'}).min(1, 'La categoría es requerida'),
  date: z.string({ required_error: 'La fecha es requerida.'}).min(1, 'La fecha es requerida'),
});

async function getCategorias(userId: string): Promise<Categoria[]> {
    const q = query(collection(db, "expenseCategories"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Categoria));
}

async function getCategoria(userId: string, categoryId: string): Promise<Categoria | null> {
    const docRef = doc(db, "expenseCategories", categoryId);
    const docSnap = await getDoc(docRef);
     if (docSnap.exists() && docSnap.data().userId === userId) {
        return { id: docSnap.id, ...docSnap.data() } as Categoria;
    }
    return null;
}

async function getIngresos(userId: string): Promise<Ingreso[]> {
    const q = query(collection(db, "incomes"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingreso));
}

async function getGastos(userId: string): Promise<Gasto[]> {
    const q = query(collection(db, "expenses"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gasto));
}

export async function saveCategoria(userId: string, prevState: ActionState, formData: FormData): Promise<ActionState> {
    const data = Object.fromEntries(formData.entries());
    const validatedFields = CategoriaSchema.safeParse(data);
    
    if (!validatedFields.success) {
        return {
            success: false,
            message: 'Error de validación.',
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        const { id, ...categoriaData } = validatedFields.data;
        const dataToSave = { ...categoriaData, userId, budget: categoriaData.budget || 0 };

        if (id) {
            await updateDoc(doc(db, "expenseCategories", id), dataToSave);
        } else {
            await addDoc(collection(db, "expenseCategories"), dataToSave);
        }
        revalidatePath('/categorias');
        revalidatePath('/');
        return { success: true, message: 'Categoría guardada exitosamente.' };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
        return { success: false, message: `Error al guardar la categoría: ${errorMessage}` };
    }
}

export async function addIngreso(userId: string, prevState: ActionState, formData: FormData): Promise<ActionState> {
    const data = Object.fromEntries(formData.entries());
    const validatedFields = IngresoSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            success: false,
            message: 'Error de validación.',
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }
    
    try {
        const ingresoData = {
            ...validatedFields.data,
            userId,
            date: parseISO(validatedFields.data.date).getTime(),
        };
        await addDoc(collection(db, "incomes"), ingresoData);
        revalidatePath('/ingresos');
        revalidatePath('/');
        return { success: true, message: 'Ingreso agregado exitosamente.' };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
        return { success: false, message: `Error al agregar el ingreso: ${errorMessage}` };
    }
}

export async function addGasto(userId: string, prevState: ActionState, formData: FormData): Promise<ActionState> {
    const data = Object.fromEntries(formData.entries());
    const validatedFields = GastoSchema.safeParse(data);

    if (!validatedFields.success) {
         return {
            success: false,
            message: 'Error de validación.',
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }
    
    try {
        const gastoData = {
            ...validatedFields.data,
            userId,
            date: parseISO(validatedFields.data.date).getTime(),
        };
        await addDoc(collection(db, "expenses"), gastoData);

        const categoria = await getCategoria(userId, validatedFields.data.categoryId);
        let alertMessage: string | undefined = undefined;

        if (categoria && categoria.budget && categoria.budget > 0) {
            const q = query(collection(db, "expenses"), where("userId", "==", userId), where("categoryId", "==", validatedFields.data.categoryId));
            const gastosSnap = await getDocs(q);
            const totalGastado = gastosSnap.docs.reduce((sum, doc) => sum + doc.data().amount, 0);

            if (totalGastado > categoria.budget) {
                try {
                    const alertResult = await generateBudgetAlert({
                        category: categoria.name,
                        spentAmount: totalGastado,
                        budgetLimit: categoria.budget,
                        userName: 'Usuario',
                    });
                    alertMessage = alertResult.alertMessage;
                } catch (error) {
                    console.error("Error generating budget alert:", error);
                }
            }
        }

        revalidatePath('/gastos');
        revalidatePath('/');
        return { success: true, message: 'Gasto agregado exitosamente.', alertMessage };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
        return { success: false, message: `Error al agregar el gasto: ${errorMessage}` };
    }
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
    transaccionesRecientes
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
    revalidatePath('/');
    return result;
  } catch (error) {
    console.error("Error getting savings suggestions:", error);
    return { suggestions: ["Ocurrió un error al generar las sugerencias de ahorro."] };
  }
}
