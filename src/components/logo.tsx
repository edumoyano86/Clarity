import { Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

export const Logo = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-lg font-bold text-primary-foreground",
        className
      )}
    >
      <div className="bg-primary-foreground/20 p-2 rounded-lg">
        <Landmark className="h-6 w-6 text-primary-foreground" />
      </div>
      <span className="font-headline">Finanzas Personales</span>
    </div>
  );
};
