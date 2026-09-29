/**
 * Sort options live outside the server catalogue module so client components
 * (the listing toolbar) can import them without pulling in `server-only`.
 */
export type ProductSort =
  | 'popular'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'rating'
  | 'name-asc'
  | 'stock-asc';

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'popular', label: 'Popularity' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Customer rating' },
];

export const VALID_SORTS: ProductSort[] = SORT_OPTIONS.map((option) => option.value);
