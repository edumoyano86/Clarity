'use client';

import { useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { startOfToday, endOfToday, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Appointment } from '@/lib/definitions';
import { CalendarCheck } from 'lucide-react';

const NOTIFICATION_KEY = 'clarity-notified-today';

export function AppointmentNotifier() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !firestore) {
      return;
    }
    
    const today = new Date();
    const notificationKeyForDay = `${NOTIFICATION_KEY}-${today.toDateString()}`;
    const alreadyNotified = sessionStorage.getItem(notificationKeyForDay);

    if (alreadyNotified) {
      return;
    }

    const fetchAppointments = async () => {
      try {
        const start = startOfToday().getTime();
        const end = endOfToday().getTime();

        const appointmentsRef = collection(firestore, 'users', user.uid, 'appointments');
        const q = query(
          appointmentsRef,
          where('date', '>=', start),
          where('date', '<=', end)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            querySnapshot.forEach(doc => {
                const appointment = doc.data() as Appointment;
                
                toast({
                    title: (
                        <div className="flex items-center gap-2">
                            <CalendarCheck className="h-5 w-5" />
                            <span>Recordatorio de Cita</span>
                        </div>
                    ),
                    description: `Hoy a las ${format(new Date(appointment.date), 'p', { locale: es })}: ${appointment.title}`,
                    duration: 10000, // Show for 10 seconds
                });
            });
        }
        
        sessionStorage.setItem(notificationKeyForDay, 'true');

      } catch (error) {
        console.error("Error fetching appointments for notification:", error);
      }
    };

    fetchAppointments();

  }, [user, firestore, toast]);

  return null; // This component doesn't render anything
}
