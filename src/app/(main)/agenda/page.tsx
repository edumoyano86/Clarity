'use client';
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Appointment } from "@/lib/definitions";
import { AgendaManager } from "@/components/agenda/agenda-manager";
import { collection, orderBy, query } from "firebase/firestore";

export default function AgendaPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'appointments'), orderBy('date', 'asc'));
    }, [firestore, user]);

    const { data: appointments, isLoading: loadingAppointments } = useCollection<Appointment>(appointmentsQuery);
    
    if (isUserLoading || loadingAppointments || !user) {
        return <p>Cargando agenda...</p>
    }

    return <AgendaManager appointments={appointments || []} userId={user.uid} />;
}
