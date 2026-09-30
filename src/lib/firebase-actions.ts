'use server';

import { db } from "@/firebase/server"; 
import { Categoria, Gasto, Ingreso } from "./definitions";
import { parseISO } from 'date-fns';
import { generateBudgetAlert } from "@/ai/flows/budget-alerts";

// --- Generic Firestore Functions using Firebase Admin ---
const getCollection = async <T>(collectionPath: string): Promise<T[]> => {
    const snapshot = await db.collection(collectionPath).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
};

const getDocument = async <T>(collectionPath: string, id: string): Promise<T | null> => {
    const docSnap = await db.collection(collectionPath).doc(id).get();
    if (docSnap.exists) {
        return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
};

// --- Categorias ---
export const getCategorias = async (userId: string) => getCollection<Categoria>(`users/${userId}/expenseCategories`);
export const getCategoria = async (userId: string, id: string) => getDocument<Categoria>(`users/${userId}/expenseCategories`, id);

export const saveCategoria = async (userId: string, data: Omit<Categoria, 'id'> & { id?: string }) => {
    const { id, ...rest } = data;
    const collectionRef = db.collection(`users/${userId}/expenseCategories`);
    if (id) {
        await collectionRef.doc(id).update(rest);
    } else {
        await collectionRef.add(rest);
    }
};

// --- Ingresos ---
export const getIngresos = async (userId: string) => getCollection<Ingreso>(`users/${userId}/incomes`);

export const addIngreso = async (userId: string, data: Omit<Ingreso, 'id' | 'date'> & { date: string }) => {
    const ingresoData = {
        ...data,
        date: parseISO(data.date).getTime(),
    };
    await db.collection(`users/${userId}/incomes`).add(ingresoData);
};

// --- Gastos ---
export const getGastos = async (userId: string) => getCollection<Gasto>(`users/${userId}/expenses`);

async function getGastosByCategoria(userId: string, categoryId: string): Promise<Gasto[]> {
    const snapshot = await db.collection(`users/${userId}/expenses`).where("categoryId", "==", categoryId).get();
    return snapshot.docs.map((doc) => doc.data() as Gasto);
}

export const addGasto = async (
    userId: string,
    data: Omit<Gasto, 'id' | 'date'> & { date: string }
): Promise<string | undefined> => {
    const gastoData = {
        ...data,
        date: parseISO(data.date).getTime(),
    };
    await db.collection(`users/${userId}/expenses`).add(gastoData);

    const categoria = await getCategoria(userId, data.categoryId || '');

    if (categoria && categoria.budget && categoria.budget > 0) {
        const gastosCategoria = await getGastosByCategoria(userId, categoria.id);
        const totalGastado = gastosCategoria.reduce((sum, g) => sum + g.amount, 0);

        if (totalGastado > categoria.budget) {
            try {
                // Assuming 'Usuario' is a placeholder for the actual user name
                const alertResult = await generateBudgetAlert({
                    category: categoria.name,
                    spentAmount: totalGastado,
                    budgetLimit: categoria.budget,
                    userName: 'Usuario',
                });
                return alertResult.alertMessage;
            } catch (error) {
                console.error("Error generating budget alert:", error);
                return undefined;
            }
        }
    }
    return undefined;
};
