'use server';

import { getDocs, collection, query } from 'firebase/firestore';
import { generateSavingsSuggestions } from '@/ai/flows/savings-suggestions';
import { db } from '@/firebase/server';
import type { Categoria, Gasto } from './definitions';

export async function getSavingsSuggestionsAction(userId: string) {
  try {
    const expensesRef = collection(db, `users/${userId}/expenses`);
    const categoriesRef = collection(db, `users/${userId}/expenseCategories`);

    const [expensesSnap, categoriesSnap] = await Promise.all([
        getDocs(expensesRef),
        getDocs(categoriesRef),
    ]);

    const gastos = expensesSnap.docs.map(doc => doc.data() as Gasto);
    const categorias = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Categoria));

    if (gastos.length === 0) {
      return { suggestions: ["No tienes suficientes datos de gastos para generar sugerencias."] };
    }
    
    const categoryMap = new Map(categorias.map(c => [c.id, c.name]));

    const spendingData = gastos.reduce((acc, gasto) => {
        const categoryName = categoryMap.get(gasto.categoryId) || 'Desconocido';
        if (!acc[categoryName]) {
            acc[categoryName] = 0;
        }
        acc[categoryName] += gasto.amount;
        return acc;
    }, {} as Record<string, number>);

    const spendingDataString = Object.entries(spendingData)
        .map(([category, amount]) => `${category}: $${amount.toFixed(2)}`)
        .join(', ');

    const result = await generateSavingsSuggestions({
      spendingData: spendingDataString,
    });
    
    return result;
  } catch (error) {
    console.error('Error generating savings suggestions:', error);
    return { suggestions: ["Hubo un error al generar sugerencias. Inténtalo de nuevo."] };
  }
}
