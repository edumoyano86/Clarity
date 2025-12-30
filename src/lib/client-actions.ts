'use client';

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Categoria, Gasto, Ingreso } from './definitions';
import { generateBudgetAlert } from '@/ai/flows/budget-alerts';
import { parseISO } from 'date-fns';

// This is a new file to handle client-side Firestore operations directly,
// bypassing the Server Actions that were causing issues.

// Helper to get gastos for a specific category
async function getGastosByCategoria(
  firestore: any,
  categoriaId: string
): Promise<Gasto[]> {
  const gastosRef = collection(firestore, 'gastos');
  const q = query(gastosRef, where('categoriaId', '==', categoriaId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => doc.data() as Gasto);
}

// Categorias
export const saveCategoria = async (
  firestore: any,
  data: Omit<Categoria, 'id'> & { id?: string }
) => {
  if (data.id) {
    const { id, ...rest } = data;
    await updateDoc(doc(firestore, 'categorias', id), rest);
  } else {
    await addDoc(collection(firestore, 'categorias'), data);
  }
};

// Ingresos
export const addIngreso = async (
  firestore: any,
  data: Omit<Ingreso, 'id' | 'fecha'> & { fecha: string }
) => {
  const ingresoData = {
    ...data,
    fecha: parseISO(data.fecha).getTime(),
  };
  await addDoc(collection(firestore, 'ingresos'), ingresoData);
};

// Gastos
export const addGasto = async (
  firestore: any,
  data: Omit<Gasto, 'id' | 'fecha'> & { fecha: string },
  categorias: Categoria[]
): Promise<string | undefined> => {
  const gastoData = {
    ...data,
    fecha: parseISO(data.fecha).getTime(),
  };
  await addDoc(collection(firestore, 'gastos'), gastoData);

  // Check for budget alert
  const categoria = categorias.find((c) => c.id === data.categoriaId);
  if (categoria && categoria.presupuesto && categoria.presupuesto > 0) {
    const gastosCategoria = await getGastosByCategoria(
      firestore,
      categoria.id
    );
    const totalGastado = gastosCategoria.reduce(
      (sum, g) => sum + g.cantidad,
      0
    );

    if (totalGastado > categoria.presupuesto) {
      const alertResult = await generateBudgetAlert({
        category: categoria.nombre,
        spentAmount: totalGastado,
        budgetLimit: categoria.presupuesto,
        userName: 'Usuario',
      });
      return alertResult.alertMessage;
    }
  }
  return undefined;
};
