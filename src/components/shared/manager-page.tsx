'use client';

import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

interface ManagerPageProps {
    title: string;
    description: string;
    buttonLabel: string;
    onButtonClick: () => void;
    children: React.ReactNode;
}

export function ManagerPage({ title, description, buttonLabel, onButtonClick, children }: ManagerPageProps) {
    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline">{title}</h1>
                    <p className="text-muted-foreground">{description}</p>
                </div>
                <Button onClick={onButtonClick}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {buttonLabel}
                </Button>
            </div>
            {children}
        </div>
    )
}
