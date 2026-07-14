"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, TrendingUp, PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";

export type SavingsGoal = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
};

type SavingsGoalsProps = {
  goals?: SavingsGoal[];
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);

export function SavingsGoals({ goals = [] }: SavingsGoalsProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [localGoals, setLocalGoals] = useState<SavingsGoal[]>(goals);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (!firestore || !user) return;
    const goalsRef = collection(firestore, "users", user.uid, "savingsGoals");
    const q = query(goalsRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<SavingsGoal, "id">),
      })) as SavingsGoal[];
      setLocalGoals(items);
    });
    return () => unsubscribe();
  }, [firestore, user]);

  const addGoal = async () => {
    if (!title.trim() || !firestore || !user) return;
    setIsSaving(true);
    try {
      const goal: Omit<SavingsGoal, "id"> = {
        title: title.trim(),
        targetAmount: Number(targetAmount) || 0,
        currentAmount: Number(currentAmount) || 0,
        deadline: deadline.trim() || undefined,
      };
      await addDoc(collection(firestore, "users", user.uid, "savingsGoals"), {
        ...goal,
        createdAt: Date.now(),
      });
      setTitle("");
      setTargetAmount("");
      setCurrentAmount("");
      setDeadline("");
    } finally {
      setIsSaving(false);
    }
  };

  const removeGoal = async (id: string) => {
    if (!firestore || !user) return;
    await deleteDoc(doc(firestore, "users", user.uid, "savingsGoals", id));
  };

  const updateGoalProgress = async (goal: SavingsGoal) => {
    if (!firestore || !user) return;
    const nextValue = Number(prompt("Actualiza el monto ahorrado actual:", String(goal.currentAmount))) || goal.currentAmount;
    await updateDoc(doc(firestore, "users", user.uid, "savingsGoals", goal.id), {
      currentAmount: nextValue,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <CardTitle>Metas de ahorro</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => localGoals.forEach((goal) => removeGoal(goal.id))}>
            Limpiar
          </Button>
        </div>
        <CardDescription>Crea metas y actualizalas según tu progreso.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-lg border p-3">
          <div className="grid gap-2">
            <Label>Nombre de la meta</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Vacaciones" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Meta total</Label>
              <Input type="number" min="0" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="500000" />
            </div>
            <div>
              <Label>Ahorrado</Label>
              <Input type="number" min="0" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} placeholder="120000" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Fecha límite</Label>
            <Input value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="Ej: Septiembre" />
          </div>
          <Button onClick={addGoal} size="sm" className="w-full" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Añadir meta
          </Button>
        </div>

        {!localGoals.length ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Todavía no añadiste metas. Puedes dejar este bloque vacío si no lo necesitas.
          </div>
        ) : (
          localGoals.map((goal) => {
            const progress = Math.min(100, (goal.currentAmount / Math.max(goal.targetAmount, 1)) * 100);
            const remaining = goal.targetAmount - goal.currentAmount;
            return (
              <div key={goal.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{goal.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => updateGoalProgress(goal)}>
                      Actualizar
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeGoal(goal.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{remaining > 0 ? `${formatCurrency(remaining)} restante` : "Meta alcanzada"}</span>
                  {goal.deadline ? <span>{goal.deadline}</span> : null}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
