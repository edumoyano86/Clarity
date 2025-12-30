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
  fecha: string; // ISO string
};

export type Gasto = {
  id: string;
  cantidad: number;
  categoriaId: string;
  fecha: string; // ISO string
  descripcion?: string;
};

export type IconoDisponible = {
  name: string;
  icon: LucideIcon;
};
