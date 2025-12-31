'use server';

import { collection, addDoc, getDocs, doc, updateDoc, query, where, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/server"; 
import { Categoria, Gasto, Ingreso } from "./definitions";
import { parseISO } from 'date-fns';
import { generateBudgetAlert } from "@/ai/flows/budget-alerts";

// --- Generic Firestore Functions ---
const getCollection = async <T>(collectionName: string): Promise<T[]> => {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
};

const getDocument = async <T>(collectionName: string, id: string): Promise<T | null> => {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
}

// --- Categorias ---
export const getCategorias = async (userId: string) => getCollection<Categoria>(`users/${userId}/expenseCategories`);
export const getCategoria = async (userId: string, id: string) => getDocument<Categoria>(`users/${userId}/expenseCategories`, id);

export const saveCategoria = async (userId: string, data: Omit<Categoria, 'id'> & { id?: string }) => {
    const { id, ...rest } = data;
    const categoriaData = { ...rest, userId };
    if (id) {
        await updateDoc(doc(db, `users/${userId}/expenseCategories`, id), categoriaData);
    } else {
        await addDoc(collection(db, `users/${userId}/expenseCategories`), categoriaData);
    }
};

// --- Ingresos ---
export const getIngresos = async (userId: string) => getCollection<Ingreso>(`users/${userId}/incomes`);

export const addIngreso = async (userId: string, data: Omit<Ingreso, 'id' | 'date'> & { date: string }) => {
    const ingresoData = {
        ...data,
        userId,
        date: parseISO(data.date).getTime(),
    };
    await addDoc(collection(db, `users/${userId}/incomes`), ingresoData);
};

// --- Gastos ---
export const getGastos = async (userId: string) => getCollection<Gasto>(`users/${userId}/expenses`);

async function getGastosByCategoria(userId: string, categoryId: string): Promise<Gasto[]> {
    const gastosRef = collection(db, `users/${userId}/expenses`);
    const q = query(gastosRef, where('categoryId', '==', categoryId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data() as Gasto);
}

export const addGasto = async (
    userId: string,
    data: Omit<Gasto, 'id' | 'date'> & { date: string }
): Promise<string | undefined> => {
    const gastoData = {
        ...data,
        userId,
        date: parseISO(data.date).getTime(),
    };
    await addDoc(collection(db, `users/${userId}/expenses`), gastoData);

    const categoria = await getCategoria(userId, data.categoryId);

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
