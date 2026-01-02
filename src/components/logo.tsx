'use client';
import { cn } from "@/lib/utils";
import Image from "next/image";

const ClarityLogoIcon = () => (
  <Image src="/logo.png" alt="Clarity Logo" width={40} height={40} />
);

export const Logo = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-lg font-bold",
        className
      )}
    >
      <ClarityLogoIcon />
       <div className="flex flex-col group-data-[collapsible=icon]:hidden">
        <span className="font-headline text-2xl text-sidebar-foreground">Clarity</span>
        <span className="text-xs font-normal text-sidebar-foreground/80 -mt-1">Tus finanzas claras</span>
      </div>
    </div>
  );
};
