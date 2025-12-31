'use server';

import { getDocs, collection } from 'firebase/firestore';
import { generateSavingsSuggestions } from '@/ai/flows/savings-suggestions';
import { db } from '@/firebase/server';
import type { Categoria, Transaction } from './definitions';

export async function getSavingsSuggestionsAction(userId: string) {
  try {
    const transactionsRef = collection(db, `users/${userId}/transactions`);
    const categoriesRef = collection(db, `users/${userId}/expenseCategories`);

    const [transactionsSnap, categoriesSnap] = await Promise.all([
        getDocs(transactionsRef),
        getDocs(categoriesRef),
    ]);

    const gastos = transactionsSnap.docs.map(doc => doc.data() as Transaction).filter(t => t.type === 'gasto');
    const categorias = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Categoria));

    if (gastos.length === 0) {
      return { suggestions: ["No tienes suficientes datos de gastos para generar sugerencias."] };
    }
    
    const categoryMap = new Map(categorias.map(c => [c.id, c.name]));

    const spendingData = gastos.reduce((acc, gasto) => {
        if (!gasto.categoryId) return acc;
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
