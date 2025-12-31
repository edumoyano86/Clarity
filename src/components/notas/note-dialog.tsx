'use client';

import { useEffect, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Note } from '@/lib/definitions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const NoteSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, 'El título es requerido.'),
    content: z.string().min(1, 'El contenido es requerido.'),
});

type FormValues = z.infer<typeof NoteSchema>;

interface NoteDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    note?: Note;
    userId: string;
    onSuccess: () => void;
}

export function NoteDialog({ isOpen, onOpenChange, note, userId, onSuccess }: NoteDialogProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
        resolver: zodResolver(NoteSchema),
    });

    useEffect(() => {
        if (isOpen) {
            if (note) {
                reset({
                    id: note.id,
                    title: note.title,
                    content: note.content,
                });
            } else {
                reset({
                    id: '',
                    title: '',
                    content: '',
                });
            }
        }
    }, [isOpen, note, reset]);

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        try {
            const collectionRef = collection(firestore, 'users', userId, 'notes');
            if (data.id) {
                await setDoc(doc(collectionRef, data.id), { ...data, updatedAt: new Date().getTime() }, { merge: true });
            } else {
                const now = new Date().getTime();
                await addDoc(collectionRef, { ...data, createdAt: now, updatedAt: now });
            }
            toast({ title: 'Éxito', description: 'Nota guardada correctamente.' });
            onSuccess();
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudo guardar la nota.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{note ? 'Editar' : 'Nueva'} Nota</DialogTitle>
                    <DialogDescription>
                        {note ? 'Modifica los detalles de tu nota.' : 'Añade una nueva nota para tus ideas.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <input type="hidden" {...register('id')} />
                    <div>
                        <Label htmlFor="title">Título</Label>
                        <Input id="title" {...register('title')} />
                        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="content">Contenido</Label>
                        <Textarea id="content" {...register('content')} rows={10} />
                        {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Nota'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
