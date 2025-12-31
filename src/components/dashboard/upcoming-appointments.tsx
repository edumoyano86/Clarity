'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Appointment } from "@/lib/definitions";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";

interface UpcomingAppointmentsProps {
    appointments: Appointment[];
    isLoading: boolean;
}

export function UpcomingAppointments({ appointments, isLoading }: UpcomingAppointmentsProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Próximas Citas</CardTitle>
                <CardDescription>Tus próximos 3 eventos agendados.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : appointments.length > 0 ? (
                    <ul className="space-y-4">
                        {appointments.map(app => (
                            <li key={app.id} className="flex items-start gap-4">
                                <div className="flex flex-col items-center justify-center rounded-md bg-muted p-2">
                                     <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{format(new Date(app.date), 'MMM', { locale: es })}</span>
                                     <span className="text-lg font-bold text-foreground">{format(new Date(app.date), 'd')}</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold">{app.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {format(new Date(app.date), 'p', { locale: es })}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center text-muted-foreground py-4">
                        <CalendarIcon className="mx-auto h-8 w-8" />
                        <p className="mt-2 text-sm">No tienes citas próximas.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
