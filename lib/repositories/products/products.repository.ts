import type {
  CatalogProduct,
  CatalogProductUpdate,
  CatalogProductVersion,
  NewCatalogProduct,
} from "./product.entity";

/** The product catalog repository port. */
export interface ProductsRepository {
  findById(id: string): Promise<CatalogProduct | null>;
  list(): Promise<CatalogProduct[]>;
  listVersions(): Promise<CatalogProductVersion[]>;
  create(input: NewCatalogProduct): Promise<CatalogProduct>;
  update(id: string, input: CatalogProductUpdate): Promise<CatalogProduct>;
  delete(id: string): Promise<void>;
}
