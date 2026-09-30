'use client';

import React, { useEffect, useState } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WishlistItem, PriorityLevel, Categoria } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { Loader2, Sparkles, Tag, ExternalLink, DollarSign } from 'lucide-react';

const WishlistSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'El nombre del deseo o artículo es requerido.'),
  estimatedPrice: z.coerce
    .number({ invalid_type_error: 'Debe ser un número válido.' })
    .min(0, 'El precio estimado debe ser mayor o igual a 0.'),
  priority: z.enum(['alta', 'media', 'baja'] as const, {
    required_error: 'Selecciona una prioridad.',
  }),
  category: z.string().optional(),
  url: z.string().url('Debe ser una URL válida (ej. https://...).').optional().or(z.literal('')),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof WishlistSchema>;

interface WishlistFormProps {
  userId: string;
  item?: WishlistItem;
  categories?: Categoria[];
  onFormSuccess: () => void;
}

export function WishlistForm({ userId, item, categories = [], onFormSuccess }: WishlistFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(WishlistSchema),
    defaultValues: {
      title: '',
      estimatedPrice: 0,
      priority: 'media',
      category: '',
      url: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (item) {
      reset({
        id: item.id,
        title: item.title,
        estimatedPrice: item.estimatedPrice,
        priority: item.priority,
        category: item.category || '',
        url: item.url || '',
        notes: item.notes || '',
      });
    } else {
      reset({
        id: '',
        title: '',
        estimatedPrice: 0,
        priority: 'media',
        category: '',
        url: '',
        notes: '',
      });
    }
  }, [item, reset]);

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setIsLoading(true);
    if (!firestore) return;

    try {
      if (item?.id) {
        // Edit existing wish
        const docRef = doc(firestore, 'users', userId, 'wishlist', item.id);
        await setDoc(
          docRef,
          {
            title: data.title.trim(),
            estimatedPrice: data.estimatedPrice,
            priority: data.priority,
            category: data.category?.trim() || null,
            url: data.url?.trim() || null,
            notes: data.notes?.trim() || null,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
        toast({ title: 'Éxito', description: 'Deseo actualizado correctamente.' });
      } else {
        // Add new wish
        await addDoc(collection(firestore, 'users', userId, 'wishlist'), {
          title: data.title.trim(),
          estimatedPrice: data.estimatedPrice,
          priority: data.priority,
          category: data.category?.trim() || null,
          url: data.url?.trim() || null,
          notes: data.notes?.trim() || null,
          completed: false,
          completedAt: null,
          createdAt: Date.now(),
        });
        toast({ title: 'Éxito', description: '¡Nuevo deseo añadido a tu lista!' });
      }
      onFormSuccess();
    } catch (error) {
      console.error('Error saving wishlist item:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el deseo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">¿Qué deseas comprar o consumir?</Label>
        <div className="relative">
          <Input
            id="title"
            placeholder="Ej. Monitor 27'', Zapatillas running, Curso de inglés..."
            {...register('title')}
          />
        </div>
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="estimatedPrice">Precio Estimado (ARS)</Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">$</span>
            <Input
              id="estimatedPrice"
              type="number"
              step="any"
              className="pl-7"
              placeholder="0.00"
              {...register('estimatedPrice')}
            />
          </div>
          {errors.estimatedPrice && (
            <p className="text-xs text-destructive">{errors.estimatedPrice.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="priority">Nivel de Prioridad</Label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Selecciona prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-destructive" />
                      Prioridad Alta
                    </span>
                  </SelectItem>
                  <SelectItem value="media">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Prioridad Media
                    </span>
                  </SelectItem>
                  <SelectItem value="baja">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Prioridad Baja
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.priority && (
            <p className="text-xs text-destructive">{errors.priority.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="category">Categoría (Opcional)</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || 'none'}
                onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="url">Enlace o Tienda (Opcional)</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://articulo.mercadolibre.com.ar/..."
            {...register('url')}
          />
          {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas o especificaciones</Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Color, modelo, características, por qué lo necesitas..."
          {...register('notes')}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
          </>
        ) : item?.id ? (
          'Actualizar Deseo'
        ) : (
          'Guardar Deseo'
        )}
      </Button>
    </form>
  );
}
