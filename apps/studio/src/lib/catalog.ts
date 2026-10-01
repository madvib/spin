import { describeCatalog } from "@spin/preset";
import type { CatalogSection } from "@spin/preset";
import type { TokenTree } from "@spin/theme";

export function catalogSections(tree: TokenTree): CatalogSection[] {
  return describeCatalog(tree);
}
