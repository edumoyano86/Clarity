'use client';

import { useState } from 'react';
import { Note } from '@/lib/definitions';
import { ManagerPage } from '../shared/manager-page';
import { NoteCard } from './note-card';
import { NoteDialog } from './note-dialog';
import { useUser } from '@/firebase';

export function NotesManager({ notes, userId }: { notes: Note[], userId: string }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedNote, setSelectedNote] = useState<Note | undefined>(undefined);

    const handleOpenDialog = (note?: Note) => {
        setSelectedNote(note);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setSelectedNote(undefined);
    }

    return (
        <>
            <ManagerPage
                title="Notas"
                description="Captura tus ideas y pensamientos."
                buttonLabel="Añadir Nota"
                onButtonClick={() => handleOpenDialog()}
            >
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {notes.map((note) => (
                        <NoteCard 
                            key={note.id} 
                            note={note} 
                            onEdit={() => handleOpenDialog(note)}
                            userId={userId}
                        />
                    ))}
                </div>
                 {notes.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                        <p>No tienes notas todavía.</p>
                        <p>¡Crea tu primera nota para empezar!</p>
                    </div>
                )}
            </ManagerPage>
            
            <NoteDialog 
                isOpen={isDialogOpen} 
                onOpenChange={setIsDialogOpen}
                note={selectedNote}
                userId={userId}
                onSuccess={handleCloseDialog}
            />
        </>
    );
}
