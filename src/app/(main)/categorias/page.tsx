import { getCategorias } from "@/lib/actions";
import { CategoryManager } from "@/components/categorias/category-manager";

export default async function CategoriasPage() {
    const categorias = await getCategorias();
    return <CategoryManager categorias={categorias} />;
}
