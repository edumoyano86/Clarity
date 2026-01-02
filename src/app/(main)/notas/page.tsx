'use client';
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Note } from "@/lib/definitions";
import { NotesManager } from "@/components/notas/notes-manager";
import { collection, orderBy, query } from "firebase/firestore";

export default function NotasPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();

    const notesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'notes'), orderBy('updatedAt', 'desc'));
    }, [firestore, user]);

    const { data: notes, isLoading: loadingNotes } = useCollection<Note>(notesQuery);
    
    if (isUserLoading || loadingNotes || !user) {
        return <p>Cargando notas...</p>
    }

    return <NotesManager notes={notes || []} userId={user.uid} />;
}
