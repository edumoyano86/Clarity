'use server';

import { collection, addDoc, getDocs, doc, updateDoc, query, where, getDoc } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";
import { Categoria, Gasto, Ingreso } from "./definitions";
import { parseISO } from 'date-fns';
import { generateBudgetAlert } from "@/ai/flows/budget-alerts";

// --- Generic Firestore Functions ---
const getCollection = async <T>(collectionName: string): Promise<T[]> => {
    const { firestore } = initializeFirebase();
    const querySnapshot = await getDocs(collection(firestore, collectionName));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
};

const getDocument = async <T>(collectionName: string, id: string): Promise<T | null> => {
    const { firestore } = initializeFirebase();
    const docRef = doc(firestore, collectionName, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
}

const addDocument = async (collectionName: string, data: any) => {
    const { firestore } = initializeFirebase();
    const docRef = await addDoc(collection(firestore, collectionName), data);
    return docRef;
};

const updateDocument = async (collectionName: string, id: string, data: any) => {
    const { firestore } = initializeFirebase();
    await updateDoc(doc(firestore, collectionName, id), data);
}

// --- Categorias ---
export const getCategorias = async () => getCollection<Categoria>('categorias');
export const getCategoria = async (id: string) => getDocument<Categoria>('categorias', id);

export const saveCategoria = async (data: Omit<Categoria, 'id'> & { id?: string }) => {
    if (data.id) {
        const { id, ...rest } = data;
        await updateDocument('categorias', id, rest);
    } else {
        await addDocument('categorias', data);
    }
};

// --- Ingresos ---
export const getIngresos = async () => getCollection<Ingreso>('ingresos');

export const addIngreso = async (data: Omit<Ingreso, 'id' | 'fecha'> & { fecha: string }) => {
    const ingresoData = {
        ...data,
        fecha: parseISO(data.fecha).getTime(),
    };
    await addDocument('ingresos', ingresoData);
};

// --- Gastos ---
export const getGastos = async () => getCollection<Gasto>('gastos');

async function getGastosByCategoria(categoriaId: string): Promise<Gasto[]> {
    const { firestore } = initializeFirebase();
    const gastosRef = collection(firestore, 'gastos');
    const q = query(gastosRef, where('categoriaId', '==', categoriaId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data() as Gasto);
}

export const addGasto = async (
    data: Omit<Gasto, 'id' | 'fecha'> & { fecha: string }
): Promise<string | undefined> => {
    const gastoData = {
        ...data,
        fecha: parseISO(data.fecha).getTime(),
    };
    await addDocument('gastos', gastoData);

    const categorias = await getCategorias();
    const categoria = categorias.find((c) => c.id === data.categoriaId);

    if (categoria && categoria.presupuesto && categoria.presupuesto > 0) {
        const gastosCategoria = await getGastosByCategoria(categoria.id);
        const totalGastado = gastosCategoria.reduce((sum, g) => sum + g.cantidad, 0);

        if (totalGastado > categoria.presupuesto) {
            try {
                const alertResult = await generateBudgetAlert({
                    category: categoria.nombre,
                    spentAmount: totalGastado,
                    budgetLimit: categoria.presupuesto,
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
