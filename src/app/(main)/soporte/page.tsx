'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Mail,
  HelpCircle,
  Copy,
  Check,
  Code2,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SoportePage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const contactEmail = 'cba2486@gmail.com';

  const copyEmail = () => {
    navigator.clipboard.writeText(contactEmail);
    setCopied(true);
    toast({
      title: 'Correo copiado',
      description: `Se copió ${contactEmail} al portapapeles.`,
    });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contacto y Preguntas Frecuentes</h1>
            <p className="text-sm text-muted-foreground">
              Proyecto de gestión financiera personal desarrollado como parte de portfolio profesional.
            </p>
          </div>
        </div>
      </div>

      {/* Developer Direct Contact Card */}
      <Card className="border-primary/30 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Code2 className="w-32 h-32" />
        </div>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Contacto Directo con el Desarrollador
            </Badge>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Clarity v2.0
            </Badge>
          </div>
          <CardTitle className="text-xl mt-3">¿Tienes alguna consulta o propuesta?</CardTitle>
          <CardDescription className="text-sm leading-relaxed max-w-2xl">
            Esta aplicación está diseñada como plataforma de control financiero personal y proyecto de demostración técnica.
            Si ingresaste desde mi portfolio o mediante búsqueda y deseas comunicarte conmigo, puedes escribirme directamente a mi casilla personal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3.5 rounded-lg bg-muted/60 border">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-primary shadow-xs">
                <Mail className="h-4 w-4" />
              </div>
              <div className="truncate">
                <p className="text-xs text-muted-foreground">Correo electrónico:</p>
                <p className="text-sm font-semibold text-foreground truncate">{contactEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyEmail}
                className="gap-1.5"
                title="Copiar email al portapapeles"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <a href={`mailto:${contactEmail}?subject=Contacto%20sobre%20Clarity`}>
                  <Mail className="h-4 w-4" />
                  Escribir correo
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQs Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-primary" />
            Guía Rápida y Preguntas Frecuentes
          </CardTitle>
          <CardDescription>
            Conoce cómo funcionan los principales módulos y herramientas de Clarity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="faq-1">
              <AccordionTrigger className="text-left font-medium">
                ¿Cómo exporto mis transacciones y cuentas por pagar a Excel?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Tanto en <strong>Transacciones</strong> como en <strong>Cuentas</strong> tienes el botón <strong>&quot;Exportar CSV&quot;</strong>. Los archivos generados cuentan con delimitador por punto y coma (;) y codificación UTF-8 BOM, abriendo al instante en Microsoft Excel y Google Sheets con todos los datos ordenados en columnas.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-2">
              <AccordionTrigger className="text-left font-medium">
                ¿Cómo funciona el historial de abonos en deudas?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                En la sección <strong>Cuentas</strong>, al hacer clic en la flecha de cada fila se despliega el historial completo de pagos parciales realizados a esa cuenta específica (fecha, hora, monto y porcentaje saldado). Además, incluye un botón para revertir un pago si te equivocaste al registrarlo.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-3">
              <AccordionTrigger className="text-left font-medium">
                ¿Qué es la regla financiera 50/30/20 y cómo se calcula?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Es una guía de salud financiera que divide tus ingresos mensuales en:
                <ul className="list-disc pl-5 mt-2 space-y-1 text-xs sm:text-sm">
                  <li><strong>50% Necesidades / Deudas:</strong> Gastos fijos obligatorios y saldos de cuentas pendientes.</li>
                  <li><strong>30% Deseos / Consumo personal:</strong> Compras recreativas o ítems de tu lista de deseos.</li>
                  <li><strong>20% Ahorro e Inversión:</strong> Patrimonio acumulado para el futuro y compras de activos.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-4">
              <AccordionTrigger className="text-left font-medium">
                ¿Cómo se cotizan las inversiones y el tipo de cambio?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Las criptomonedas se cotizan en tiempo real mediante <strong>CoinGecko</strong>. Para las acciones y CEDEARs se utiliza <strong>Finnhub API</strong>. La cotización del dólar para convertir entre pesos y dólares consulta en vivo la API argentina abierta <strong>DolarApi</strong> (Dólar Blue).
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-5">
              <AccordionTrigger className="text-left font-medium">
                ¿Dónde puedo ver todas las funciones de Clarity?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Dispones del archivo de documentación oficial en <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/clarity_funciones.txt</code>, donde se detalla el funcionamiento de cada uno de los módulos de la aplicación.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
