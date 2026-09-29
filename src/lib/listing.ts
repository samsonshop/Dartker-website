import { arrayParam, firstParam } from './utils';
import { rupeesToPaise } from './money';
import { VALID_SORTS, type ProductSort } from './catalog-sort';

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export interface ParsedListingParams {
  categories: string[];
  colors: string[];
  minPaise?: number;
  maxPaise?: number;
  inStockOnly: boolean;
  sort: ProductSort;
  page: number;
  q?: string;
}

/** Single parser shared by the category page, search page and their metadata. */
export function parseListingParams(params: SearchParamsInput): ParsedListingParams {
  const rawSort = firstParam(params.sort);
  const sort = VALID_SORTS.includes(rawSort as ProductSort) ? (rawSort as ProductSort) : 'popular';

  const minRupees = Number(firstParam(params.min));
  const maxRupees = Number(firstParam(params.max));
  const page = Math.max(1, Math.floor(Number(firstParam(params.page)) || 1));

  return {
    categories: arrayParam(params.category),
    colors: arrayParam(params.color),
    minPaise: Number.isFinite(minRupees) && firstParam(params.min) ? rupeesToPaise(minRupees) : undefined,
    maxPaise: Number.isFinite(maxRupees) && firstParam(params.max) ? rupeesToPaise(maxRupees) : undefined,
    inStockOnly: firstParam(params.stock) === 'in',
    sort,
    page,
    q: firstParam(params.q)?.slice(0, 80),
  };
}
