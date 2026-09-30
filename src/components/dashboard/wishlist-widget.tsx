'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WishlistItem } from '@/lib/definitions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

interface WishlistWidgetProps {
  items: WishlistItem[];
  userId: string;
  isLoading: boolean;
}

export function WishlistWidget({ items, userId, isLoading }: WishlistWidgetProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleToggle = async (item: WishlistItem) => {
    if (!firestore) return;
    try {
      const nextCompleted = !item.completed;
      await updateDoc(doc(firestore, 'users', userId, 'wishlist', item.id), {
        completed: nextCompleted,
        completedAt: nextCompleted ? Date.now() : null,
      });
      if (nextCompleted) {
        toast({
          title: '🎉 ¡Deseo cumplido!',
          description: `Tachaste "${item.title}". Puedes registrarlo como gasto en Deseos y Prioridades.`,
        });
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el deseo.',
        variant: 'destructive',
      });
    }
  };

  // Show top pending items (priority: alta first, then media, then baja)
  const pendingItems = items
    .filter((i) => !i.completed)
    .sort((a, b) => {
      const weights = { alta: 3, media: 2, baja: 1 };
      const diff = weights[b.priority] - weights[a.priority];
      if (diff !== 0) return diff;
      return b.createdAt - a.createdAt;
    })
    .slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Prioridades de Compra
          </CardTitle>
          <CardDescription>Cosas que deseas adquirir y puedes ir tachando.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-xs">
          <Link href="/deseos" className="flex items-center gap-1">
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingItems.length > 0 ? (
          <ul className="space-y-3">
            {pendingItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-lg border bg-card/60 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Checkbox
                    id={`dash-wish-${item.id}`}
                    checked={item.completed}
                    onCheckedChange={() => handleToggle(item)}
                    className="h-4 w-4 data-[state=checked]:bg-emerald-500 rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`dash-wish-${item.id}`}
                      className="text-sm font-medium leading-none cursor-pointer select-none block truncate"
                    >
                      {item.title}
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      {item.priority === 'alta' && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 uppercase">
                          Alta
                        </Badge>
                      )}
                      {item.priority === 'media' && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400"
                        >
                          Media
                        </Badge>
                      )}
                      {item.priority === 'baja' && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                          Baja
                        </Badge>
                      )}
                      {item.category && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {item.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right pl-2">
                  <span className="text-sm font-bold block">
                    {formatCurrency(item.estimatedPrice)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center text-muted-foreground py-6 space-y-2">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm">No tienes compras prioritarias pendientes.</p>
            <Button size="sm" variant="outline" asChild className="text-xs">
              <Link href="/deseos">Añadir un deseo</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
