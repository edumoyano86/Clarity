'use client';

import { useState } from 'react';
import { Note } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Edit, MoreVertical, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface NoteCardProps {
    note: Note;
    onEdit: () => void;
    userId: string;
}

export function NoteCard({ note, onEdit, userId }: NoteCardProps) {
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleDelete = async () => {
        try {
            await deleteDoc(doc(firestore, 'users', userId, 'notes', note.id));
            toast({ title: 'Éxito', description: 'Nota eliminada correctamente.' });
        } catch (error) {
             toast({ title: 'Error', description: 'No se pudo eliminar la nota.', variant: 'destructive' });
        } finally {
            setIsAlertOpen(false);
        }
    };
    
    return (
       <>
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="flex justify-between items-start">
                        <span className="truncate pr-2">{note.title}</span>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className='-mt-2 -mr-2 h-8 w-8 flex-shrink-0'>
                                    <MoreVertical className='h-4 w-4' />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                                <DropdownMenuItem onClick={onEdit}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>Editar</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsAlertOpen(true)} className="text-destructive">
                                     <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Eliminar</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-4">{note.content}</p>
                </CardContent>
                <CardFooter>
                     <CardDescription>
                        Actualizado {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true, locale: es })}
                    </CardDescription>
                </CardFooter>
            </Card>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente la nota.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
       </>
    );
}
