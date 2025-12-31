import { cn } from "@/lib/utils";

const ClarityLogoIcon = () => (
    <svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 44C42.3761 44 50.9333 35.3761 50.9333 25C50.9333 14.6239 42.3761 6 32 6C21.6239 6 13.0667 14.6239 13.0667 25C13.0667 35.3761 21.6239 44 32 44Z" stroke="#00A99D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
        <path d="M57 25.1316C52.9333 38.2649 42.1333 46.9316 32 46.9316C21.8667 46.9316 11.0667 38.2649 7 25.1316" stroke="#005B8A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M41.4667 25.1316C41.4667 30.3858 37.2273 34.6649 32 34.6649C26.7727 34.6649 22.5333 30.3858 22.5333 25.1316C22.5333 19.8774 26.7727 15.6 32 15.6C37.2273 15.6 41.4667 19.8774 41.4667 25.1316Z" fill="#003E5E"/>
        <path d="M36.2667 19.333V11.2C36.2667 9.98478 37.2181 9.03333 38.4 9.03333C39.5819 9.03333 40.5333 9.98478 40.5333 11.2V12.2667" stroke="#FBB040" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M38.4 6.93333C39.8376 6.93333 41.0667 8.16242 41.0667 9.6C41.0667 11.0376 39.8376 12.2667 38.4 12.2667C36.9624 12.2667 35.7333 11.0376 35.7333 9.6C35.7333 8.16242 36.9624 6.93333 38.4 6.93333Z" fill="#FBB040"/>
        <path d="M32.8,55.4667 C33.4667,54.8 34.1333,54.1333 34.8,53.4667" stroke="#FBB040" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7,25.1316 C11.0667,11.9983 21.8667,3.3316 32,3.3316 C42.1333,3.3316 52.9333,11.9983 57,25.1316" stroke="#FBB040" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M33.6,18.4 L46.9333,5.06667" stroke="#FBB040" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M42.6667 5.06667H46.9333V9.33333" stroke="#FBB040" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);


export const Logo = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-lg font-bold text-primary-foreground",
        className
      )}
    >
      <ClarityLogoIcon />
      <div className="flex flex-col">
        <span className="font-headline text-2xl text-foreground">Clarity</span>
        <span className="text-xs font-normal text-muted-foreground -mt-1">Tus finanzas claras</span>
      </div>
    </div>
  );
};
