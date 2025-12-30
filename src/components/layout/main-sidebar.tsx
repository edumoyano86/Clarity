
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
  TrendingUp,
  TrendingDown,
  Shapes,
  Settings,
  CircleHelp,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

const menuItems = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/ingresos", label: "Ingresos", icon: TrendingUp },
  { href: "/gastos", label: "Gastos", icon: TrendingDown },
  { href: "/categorias", label: "Categorías", icon: Shapes },
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
              <Link href={item.href} passHref>
                <SidebarMenuButton
                  isActive={pathname === item.href}
                  icon={<item.icon />}
                  tooltip={item.label}
                >
                  {item.label}
                </SidebarMenuButton>
              </Link>
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
