import { getIngresos } from "@/lib/actions";
import { IncomeManager } from "@/components/ingresos/income-manager";

export default async function IngresosPage() {
    const ingresos = await getIngresos();
    const sortedIngresos = ingresos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    return <IncomeManager ingresos={sortedIngresos} />;
}
