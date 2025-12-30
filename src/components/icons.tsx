import { type LucideProps } from "lucide-react";
import { iconMap } from "@/lib/icons";

interface IconProps extends LucideProps {
  name: string;
}

export const Icon = ({ name, ...props }: IconProps) => {
  const LucideIcon = iconMap[name];

  if (!LucideIcon) {
    return null;
  }

  return <LucideIcon {...props} />;
};
