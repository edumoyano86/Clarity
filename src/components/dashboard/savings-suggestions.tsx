"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { getSavingsSuggestionsAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function SavingsSuggestions({ userId }: { userId: string }) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setSuggestions([]);
    try {
      const result = await getSavingsSuggestionsAction(userId);
      if (result.suggestions) {
        setSuggestions(result.suggestions);
      }
    } catch (error) {
      setSuggestions(["Error al generar sugerencias."]);
    } finally {
      setIsLoading(false);
      setHasGenerated(true);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Sugerencias de Ahorro con IA</CardTitle>
                <CardDescription>Obtén consejos personalizados para mejorar tus finanzas.</CardDescription>
            </div>
            <Button onClick={handleGenerate} disabled={isLoading} size="sm">
                {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generar
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Analizando tus gastos...</p>}
        {!isLoading && hasGenerated && (
          <Accordion type="single" collapsible className="w-full">
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
                <AccordionItem value={`item-${index}`} key={index}>
                  <AccordionTrigger>Sugerencia #{index + 1}</AccordionTrigger>
                  <AccordionContent>{suggestion}</AccordionContent>
                </AccordionItem>
              ))
            ) : (
              <p className="text-muted-foreground">No se pudieron generar sugerencias.</p>
            )}
          </Accordion>
        )}
        {!isLoading && !hasGenerated && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Haz clic en "Generar" para recibir sugerencias de ahorro personalizadas de nuestra IA.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
