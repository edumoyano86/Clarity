"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, useUser } from "@/firebase";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";

export type RecurringTransaction = {
  id: string;
  description: string;
  amount: number;
  type: "ingreso" | "gasto";
  cadence: "mensual" | "semanal";
  nextDate: number;
};

export function RecurringTransactions() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"ingreso" | "gasto">("gasto");
  const [cadence, setCadence] = useState<"mensual" | "semanal">("mensual");

  useEffect(() => {
    if (!firestore || !user) return;
    const ref = collection(firestore, "users", user.uid, "recurringTransactions");
    const q = query(ref, orderBy("nextDate", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<RecurringTransaction, "id">) })) as RecurringTransaction[]);
    });
    return () => unsubscribe();
  }, [firestore, user]);

  const addItem = async () => {
    if (!firestore || !user || !description.trim()) return;
    await addDoc(collection(firestore, "users", user.uid, "recurringTransactions"), {
      description: description.trim(),
      amount: Number(amount) || 0,
      type,
      cadence,
      nextDate: Date.now(),
    });
    setDescription("");
    setAmount("");
    setType("gasto");
    setCadence("mensual");
  };

  const deleteItem = async (id: string) => {
    if (!firestore || !user) return;
    await deleteDoc(doc(firestore, "users", user.uid, "recurringTransactions", id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transacciones recurrentes</CardTitle>
        <CardDescription>Define pagos o ingresos que se repitan cada cierto tiempo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Descripción</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Suscripción mensual" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>Monto</Label>
            <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" />
          </div>
          <div>
            <Label>Frecuencia</Label>
            <select value={cadence} onChange={(e) => setCadence(e.target.value as "mensual" | "semanal")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="mensual">Mensual</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant={type === "ingreso" ? "default" : "outline"} onClick={() => setType("ingreso")}>Ingreso</Button>
          <Button variant={type === "gasto" ? "default" : "outline"} onClick={() => setType("gasto")}>Gasto</Button>
        </div>
        <Button onClick={addItem} className="w-full">Guardar recurrente</Button>
        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-muted-foreground">{item.cadence} · {item.type}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)}>Eliminar</Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No añadiste recurrencias todavía.</p>
        )}
      </CardContent>
    </Card>
  );
}
