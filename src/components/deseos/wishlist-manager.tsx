'use client';

import React, { useMemo, useState } from 'react';
import { WishlistItem, Categoria, PriorityLevel } from '@/lib/definitions';
import { ManagerPage } from '../shared/manager-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { WishlistForm } from './wishlist-form';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  CheckCircle2,
  Trash2,
  Edit,
  ExternalLink,
  Search,
  Tag,
  ShoppingBag,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Loader2,
  Layers,
} from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

interface WishlistManagerProps {
  items: WishlistItem[];
  userId: string;
  categories?: Categoria[];
}

type FilterStatus = 'todos' | 'pendientes' | 'cumplidos';

export function WishlistManager({ items, userId, categories = [] }: WishlistManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isConvertToExpenseOpen, setIsConvertToExpenseOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WishlistItem | undefined>(undefined);
  const [itemToDelete, setItemToDelete] = useState<WishlistItem | null>(null);
  const [itemToConvert, setItemToConvert] = useState<WishlistItem | null>(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos');
  const [filterPriority, setFilterPriority] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState('');

  const firestore = useFirestore();
  const { toast } = useToast();

  const handleOpenForm = (item?: WishlistItem) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedItem(undefined);
  };

  const handleOpenAlert = (item: WishlistItem) => {
    setItemToDelete(item);
    setIsAlertOpen(true);
  };

  const handleCloseAlert = () => {
    setItemToDelete(null);
    setIsAlertOpen(false);
  };

  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'users', userId, 'wishlist', itemToDelete.id));
      toast({ title: 'Éxito', description: 'Deseo eliminado de la lista.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el deseo.', variant: 'destructive' });
    } finally {
      handleCloseAlert();
    }
  };

  const handleToggleComplete = async (item: WishlistItem) => {
    if (!firestore) return;
    const nextCompleted = !item.completed;
    try {
      await updateDoc(doc(firestore, 'users', userId, 'wishlist', item.id), {
        completed: nextCompleted,
        completedAt: nextCompleted ? Date.now() : null,
      });

      if (nextCompleted) {
        toast({
          title: '🎉 ¡Deseo cumplido!',
          description: `Has tachado "${item.title}". ¡Felicitaciones!`,
        });

        // Prompt to optionally register as an expense transaction
        if (item.estimatedPrice > 0) {
          setItemToConvert(item);
          // Preselect matching category if available
          const matchedCategory = categories.find(
            (c) => c.name.toLowerCase() === item.category?.toLowerCase()
          );
          setSelectedExpenseCategory(matchedCategory?.id || (categories[0]?.id ?? ''));
          setIsConvertToExpenseOpen(true);
        }
      } else {
        toast({
          title: 'Deseo restaurado',
          description: `"${item.title}" volvió a estar pendiente.`,
        });
      }
    } catch (error) {
      console.error('Error toggling wishlist item:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del deseo.',
        variant: 'destructive',
      });
    }
  };

  const handleRegisterExpense = async () => {
    if (!itemToConvert || !firestore) return;
    setIsConverting(true);
    try {
      const transactionData = {
        type: 'gasto' as const,
        amount: itemToConvert.estimatedPrice,
        date: Date.now(),
        description: `Compra cumplida: ${itemToConvert.title}`,
        categoryId: selectedExpenseCategory || null,
      };

      await addDoc(collection(firestore, 'users', userId, 'transactions'), transactionData);
      toast({
        title: 'Gasto Registrado',
        description: `Se registró el gasto de ${formatCurrency(itemToConvert.estimatedPrice)} en tus Transacciones.`,
      });
      setIsConvertToExpenseOpen(false);
      setItemToConvert(null);
    } catch (error) {
      console.error('Error registering expense:', error);
      toast({
        title: 'Error',
        description: 'No se pudo registrar la transacción de gasto.',
        variant: 'destructive',
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Metrics
  const { pendingTotal, completedTotal, pendingHighCount, completionRate, pendingCount, completedCount } =
    useMemo(() => {
      let pendingSum = 0;
      let completedSum = 0;
      let highCount = 0;
      let pCount = 0;
      let cCount = 0;

      items.forEach((item) => {
        if (item.completed) {
          cCount++;
          completedSum += item.estimatedPrice || 0;
        } else {
          pCount++;
          pendingSum += item.estimatedPrice || 0;
          if (item.priority === 'alta') highCount++;
        }
      });

      const totalItems = items.length;
      const rate = totalItems > 0 ? (cCount / totalItems) * 100 : 0;

      return {
        pendingTotal: pendingSum,
        completedTotal: completedSum,
        pendingHighCount: highCount,
        completionRate: rate,
        pendingCount: pCount,
        completedCount: cCount,
      };
    }, [items]);

  // Filtered and sorted items: pending first (priority high -> low), then completed at the end
  const filteredItems = useMemo(() => {
    const priorityWeight: Record<PriorityLevel, number> = {
      alta: 3,
      media: 2,
      baja: 1,
    };

    return items
      .filter((item) => {
        // Status filter
        if (filterStatus === 'pendientes' && item.completed) return false;
        if (filterStatus === 'cumplidos' && !item.completed) return false;

        // Priority filter
        if (filterPriority !== 'todas' && item.priority !== filterPriority) return false;

        // Search text
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(query);
          const matchNotes = item.notes?.toLowerCase().includes(query);
          const matchCategory = item.category?.toLowerCase().includes(query);
          if (!matchTitle && !matchNotes && !matchCategory) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // In 'todos': pending first, completed last
        if (!a.completed && b.completed) return -1;
        if (a.completed && !b.completed) return 1;

        // If both pending: sort by priority (alta -> baja), then by creation date desc
        if (!a.completed && !b.completed) {
          const diffPriority = priorityWeight[b.priority] - priorityWeight[a.priority];
          if (diffPriority !== 0) return diffPriority;
          return b.createdAt - a.createdAt;
        }

        // If both completed: sort by completedAt desc
        return (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt);
      });
  }, [items, filterStatus, filterPriority, searchQuery]);

  return (
    <>
      <ManagerPage
        title="Deseos y Prioridades de Compra"
        description="Organiza tus metas de consumo, compras deseadas y prioridades para alcanzarlas y tacharlas."
        buttonLabel="Nuevo Deseo o Meta"
        onButtonClick={() => handleOpenForm()}
      >
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Presupuesto Pendiente
              </CardTitle>
              <ShoppingBag className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(pendingTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingCount} {pendingCount === 1 ? 'deseo pendiente' : 'deseos pendientes'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Concretado / Cumplido
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(completedTotal)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {completedCount} {completedCount === 1 ? 'meta cumplida' : 'metas cumplidas'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-destructive">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Prioridad Alta Activa
              </CardTitle>
              <Sparkles className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{pendingHighCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Compras de mayor urgencia o deseo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tasa de Cumplimiento
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completionRate.toFixed(0)}%</div>
              <Progress value={completionRate} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Filters and Controls */}
        <Card>
          <div className="p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border p-1 bg-muted/40">
                <Button
                  variant={filterStatus === 'todos' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterStatus('todos')}
                  className="h-8 text-xs px-3"
                >
                  Todos ({items.length})
                </Button>
                <Button
                  variant={filterStatus === 'pendientes' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterStatus('pendientes')}
                  className="h-8 text-xs px-3"
                >
                  Pendientes ({pendingCount})
                </Button>
                <Button
                  variant={filterStatus === 'cumplidos' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterStatus('cumplidos')}
                  className="h-8 text-xs px-3"
                >
                  Cumplidos ({completedCount})
                </Button>
              </div>

              <div className="inline-flex rounded-lg border p-1 bg-muted/40">
                <Button
                  variant={filterPriority === 'todas' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterPriority('todas')}
                  className="h-8 text-xs px-2.5"
                >
                  Todas las Prioridades
                </Button>
                <Button
                  variant={filterPriority === 'alta' ? 'destructive' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterPriority('alta')}
                  className="h-8 text-xs px-2.5"
                >
                  Alta
                </Button>
                <Button
                  variant={filterPriority === 'media' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterPriority('media')}
                  className="h-8 text-xs px-2.5"
                >
                  Media
                </Button>
                <Button
                  variant={filterPriority === 'baja' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterPriority('baja')}
                  className="h-8 text-xs px-2.5"
                >
                  Baja
                </Button>
              </div>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar deseo o marca..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <CardContent className="pt-6">
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">
                  {filterStatus === 'cumplidos'
                    ? 'Aún no has tachado ningún deseo'
                    : filterStatus === 'pendientes'
                    ? '¡No tienes deseos pendientes!'
                    : 'Tu lista de deseos está vacía'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Agrega cosas que quieres comprar, experiencias o metas de consumo para organizarlas
                  por prioridad e ir tachándolas a medida que las logres.
                </p>
                <Button onClick={() => handleOpenForm()} className="mt-2">
                  <Sparkles className="mr-2 h-4 w-4" /> Añadir mi primer deseo
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item, index) => {
                  const isFirstCompletedInMixedView =
                    filterStatus === 'todos' &&
                    item.completed &&
                    (index === 0 || !filteredItems[index - 1].completed);

                  return (
                    <React.Fragment key={item.id}>
                      {isFirstCompletedInMixedView && (
                        <div className="pt-4 pb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span>Deseos Cumplidos y Concretados ({completedCount})</span>
                        </div>
                      )}

                      <div
                        className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                          item.completed
                            ? 'bg-muted/30 border-muted text-muted-foreground opacity-85'
                            : item.priority === 'alta'
                            ? 'bg-card border-l-4 border-l-destructive shadow-sm hover:shadow-md'
                            : 'bg-card hover:border-primary/40 shadow-sm hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                          {/* Checkbox to tach / mark as completed */}
                          <div className="pt-0.5 sm:pt-0">
                            <Checkbox
                              id={`item-${item.id}`}
                              checked={item.completed}
                              onCheckedChange={() => handleToggleComplete(item)}
                              className="h-5 w-5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 rounded-md"
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <label
                                htmlFor={`item-${item.id}`}
                                className={`font-semibold cursor-pointer select-none text-base transition-all ${
                                  item.completed
                                    ? 'line-through text-muted-foreground decoration-2 decoration-emerald-500/80'
                                    : 'text-foreground'
                                }`}
                              >
                                {item.title}
                              </label>

                              {/* Priority badge */}
                              {item.priority === 'alta' && (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] px-2 py-0.5 uppercase tracking-wider font-semibold"
                                >
                                  Prioridad Alta
                                </Badge>
                              )}
                              {item.priority === 'media' && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-2 py-0.5 border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold"
                                >
                                  Prioridad Media
                                </Badge>
                              )}
                              {item.priority === 'baja' && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-2 py-0.5 text-muted-foreground"
                                >
                                  Prioridad Baja
                                </Badge>
                              )}

                              {/* Category badge if present */}
                              {item.category && (
                                <Badge variant="outline" className="text-[11px] font-normal gap-1">
                                  <Tag className="h-3 w-3" />
                                  {item.category}
                                </Badge>
                              )}

                              {item.completed && (
                                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                  ✓ Cumplido
                                </Badge>
                              )}
                            </div>

                            {item.notes && (
                              <p
                                className={`text-xs text-muted-foreground line-clamp-2 ${
                                  item.completed ? 'line-through opacity-70' : ''
                                }`}
                              >
                                {item.notes}
                              </p>
                            )}

                            {item.completed && item.completedAt && (
                              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Concretado el{' '}
                                {new Date(item.completedAt).toLocaleDateString('es-ES')}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Price and Action buttons */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 mt-3 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-muted">
                          <div className="text-right">
                            <span
                              className={`text-lg font-bold tracking-tight block ${
                                item.completed
                                  ? 'line-through text-muted-foreground opacity-75'
                                  : 'text-foreground'
                              }`}
                            >
                              {formatCurrency(item.estimatedPrice)}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase">
                              Estimado
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {item.url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                asChild
                              >
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir enlace del producto"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenForm(item)}
                              title="Editar deseo"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleOpenAlert(item)}
                              title="Eliminar deseo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </ManagerPage>

      {/* Add / Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? 'Modificar Deseo o Prioridad' : 'Nuevo Deseo o Prioridad de Compra'}
            </DialogTitle>
            <DialogDescription>
              Añade detalles sobre el artículo o servicio que deseas adquirir para planificar tu
              consumo.
            </DialogDescription>
          </DialogHeader>
          <WishlistForm
            userId={userId}
            item={selectedItem}
            categories={categories}
            onFormSuccess={handleCloseForm}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este deseo de la lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente{' '}
              <span className="font-semibold text-foreground">"{itemToDelete?.title}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseAlert}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert to Expense Prompt Dialog */}
      <Dialog open={isConvertToExpenseOpen} onOpenChange={setIsConvertToExpenseOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              ¿Registrar compra en Transacciones?
            </DialogTitle>
            <DialogDescription>
              Acabas de tachar como cumplido{' '}
              <span className="font-semibold text-foreground">"{itemToConvert?.title}"</span>. ¿Quieres
              guardar automáticamente un gasto de{' '}
              <span className="font-semibold text-foreground">
                {itemToConvert ? formatCurrency(itemToConvert.estimatedPrice) : '$0'}
              </span>{' '}
              en tu registro de gastos?
            </DialogDescription>
          </DialogHeader>

          {categories.length > 0 && (
            <div className="space-y-2 py-2">
              <label className="text-sm font-medium">Asignar a Categoría de Gasto:</label>
              <select
                value={selectedExpenseCategory}
                onChange={(e) => setSelectedExpenseCategory(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsConvertToExpenseOpen(false);
                setItemToConvert(null);
              }}
            >
              No, solo tachar deseo
            </Button>
            <Button onClick={handleRegisterExpense} disabled={isConverting}>
              {isConverting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrando...
                </>
              ) : (
                'Sí, registrar como Gasto'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
