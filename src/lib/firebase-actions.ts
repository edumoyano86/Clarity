
import { collection, addDoc, getDocs, doc, updateDoc, query, getDoc } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";
import { Categoria, Gasto, Ingreso } from "./definitions";

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

const addDocument = async <T>(collectionName: string, data: T) => {
    const { firestore } = initializeFirebase();
    await addDoc(collection(firestore, collectionName), data as any);
};

const updateDocument = async (collectionName: string, id: string, data: any) => {
    const { firestore } = initializeFirebase();
    await updateDoc(doc(firestore, collectionName, id), data);
}

// Categorias
export const getCategorias = async () => getCollection<Categoria>('categorias');
export const getCategoria = async (id: string) => getDocument<Categoria>('categorias', id);
export const addCategoria = async (data: Omit<Categoria, 'id'>) => addDocument('categorias', data);
export const updateCategoria = async (data: Categoria) => {
    const { id, ...rest } = data;
    return updateDocument('categorias', id, rest);
};

// Ingresos
export const getIngresos = async () => getCollection<Ingreso>('ingresos');
export const addIngreso = async (data: Omit<Ingreso, 'id'>) => addDocument('ingresos', data);

// Gastos
export const getGastos = async () => getCollection<Gasto>('gastos');
export const addGasto = async (data: Omit<Gasto, 'id'>) => addDocument('gastos', data);
