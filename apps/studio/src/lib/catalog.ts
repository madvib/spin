import { describeCatalog } from "@spinjs/preset";
import type { CatalogSection } from "@spinjs/preset";
import type { TokenTree } from "@spinjs/theme";
export function catalogSections(tree: TokenTree): CatalogSection[] {
  return describeCatalog(tree);
}
