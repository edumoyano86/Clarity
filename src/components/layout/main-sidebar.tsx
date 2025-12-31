
"use client";

import { usePathname } from "next/navigation";
import {
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Settings,
  CircleHelp,
  Calendar,
  Notebook,
  ArrowRightLeft,
  Wallet,
  Shapes,
  AreaChart,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

const menuItems = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/transacciones", label: "Transacciones", icon: ArrowRightLeft },
  { href: "/cuentas", label: "Cuentas", icon: Wallet },
  { href: "/categorias", label: "Categorías", icon: Shapes },
  { href: "/inversiones", label: "Inversiones", icon: AreaChart },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/notas", label: "Notas", icon: Notebook },
];

export function MainSidebar() {
  const pathname = usePathname();

  return (
    <>
      <SidebarHeader>
        <Logo className="text-sidebar-foreground group-data-[collapsible=icon]:hidden"/>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={pathname === item.href}
                tooltip={item.label}
                icon={<item.icon />}
                asChild
              >
                <Link href={item.href}>{item.label}</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton icon={<Settings />} tooltip="Configuración">Configuración</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton icon={<CircleHelp />} tooltip="Ayuda">Ayuda</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
