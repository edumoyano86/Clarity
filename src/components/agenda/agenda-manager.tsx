'use client';

import { useState } from 'react';
import { Appointment } from '@/lib/definitions';
import { ManagerPage } from '../shared/manager-page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { AgendaForm } from './agenda-form';
import { Button } from '../ui/button';
import { Calendar as CalendarIcon, Edit, Trash2 } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export function AgendaManager({ appointments, userId }: { appointments: Appointment[], userId: string }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | undefined>(undefined);
    const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

    const firestore = useFirestore();
    const { toast } = useToast();

    const handleOpenDialog = (appointment?: Appointment) => {
        setSelectedAppointment(appointment);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setSelectedAppointment(undefined);
    }
    
    const handleOpenAlert = (appointment: Appointment) => {
        setAppointmentToDelete(appointment);
        setIsAlertOpen(true);
    };

    const handleCloseAlert = () => {
        setAppointmentToDelete(null);
        setIsAlertOpen(false);
    };
    
    const handleDelete = async () => {
        if (!appointmentToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'users', userId, 'appointments', appointmentToDelete.id));
            toast({ title: 'Éxito', description: 'Cita eliminada correctamente.' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo eliminar la cita.', variant: 'destructive' });
        } finally {
            handleCloseAlert();
        }
    };

    const appointmentsForSelectedDate = appointments.filter(app => 
        selectedDate && new Date(app.date).toDateString() === selectedDate.toDateString()
    );

    return (
        <>
            <ManagerPage
                title="Agenda"
                description="Organiza tus citas y eventos."
                buttonLabel="Añadir Cita"
                onButtonClick={() => handleOpenDialog()}
            >
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-1">
                        <Card>
                             <CardContent className="p-2">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    locale={es}
                                    className="rounded-md"
                                />
                             </CardContent>
                        </Card>
                    </div>
                    <div className="md:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Citas para {selectedDate ? format(selectedDate, 'PPP', { locale: es }) : '...'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {appointmentsForSelectedDate.length > 0 ? (
                                    <ul className="space-y-4">
                                        {appointmentsForSelectedDate.map(app => (
                                            <li key={app.id} className="flex justify-between items-center p-4 rounded-lg bg-card border">
                                                <div>
                                                    <p className="font-semibold">{app.title}</p>
                                                    <p className="text-sm text-muted-foreground">{format(new Date(app.date), 'p', { locale: es })}</p>
                                                    {app.notes && <p className="text-sm text-muted-foreground mt-1">{app.notes}</p>}
                                                </div>
                                                <div className='flex gap-2'>
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(app)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenAlert(app)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-muted-foreground text-center py-8">No hay citas para este día.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </ManagerPage>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedAppointment ? 'Editar' : 'Nueva'} Cita</DialogTitle>
                        <DialogDescription>
                            Completa los detalles de la cita.
                        </DialogDescription>
                    </DialogHeader>
                    <AgendaForm userId={userId} appointment={selectedAppointment} onFormSuccess={handleCloseDialog} />
                </DialogContent>
            </Dialog>

             <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente la cita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCloseAlert}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
