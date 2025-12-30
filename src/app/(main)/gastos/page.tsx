import { getGastos, getCategorias } from "@/lib/actions";
import { ExpenseManager } from "@/components/gastos/expense-manager";

export default async function GastosPage() {
    const [gastos, categorias] = await Promise.all([
        getGastos(),
        getCategorias()
    ]);
    
    const sortedGastos = gastos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    return <ExpenseManager gastos={sortedGastos} categorias={categorias} />;
}
