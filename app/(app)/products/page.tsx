import { ProductsLive } from "@/components/hub/screens/products-live";
import { getProductUsageCounts } from "@/lib/queries/product-usage";
import { getProductsRepository } from "@/lib/repositories/products";

export const dynamic = "force-dynamic";

/** Products catalog — wired to the products table with linked-record guardrails. */
export default async function Page() {
  const [products, usage, catalog] = await Promise.all([
    getProductsRepository().list(),
    getProductUsageCounts(),
    getProductsRepository().getCatalog(),
  ]);
  return <ProductsLive products={products} usage={usage} catalog={catalog} />;
}
