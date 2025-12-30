import type { LucideIcon } from "lucide-react";

export type Categoria = {
  id: string;
  nombre: string;
  icono: string; 
  presupuesto?: number;
};

export type Ingreso = {
  id: string;
  fuente: string;
  cantidad: number;
  fecha: number; // timestamp
};

export type Gasto = {
  id: string;
  cantidad: number;
  categoriaId: string;
  fecha: number; // timestamp
  descripcion?: string;
};

export type IconoDisponible = {
  name: string;
  icon: LucideIcon;
};
