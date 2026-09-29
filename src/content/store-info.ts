/**
 * Physical and operating details for the storefront.
 *
 * The studio address is rendered in both the footer and the "Studio" card on
 * the contact page, so it lives here rather than being typed out twice.
 * Contact email and phone come from store settings (admin-editable); these are
 * the details that do not change often enough to warrant a settings field.
 */

export const STUDIO_ADDRESS = {
  /** Street line, rendered above the locality. */
  line1: 'SF.234, Site No. 32, Diamond Avenue, Pattanam',
  /** City, state and PIN. */
  line2: 'Coimbatore, Tamil Nadu — 641016',
} as const;

/** Single-line form, for metadata and anywhere a line break would not fit. */
export const STUDIO_ADDRESS_ONE_LINE = `${STUDIO_ADDRESS.line1}, ${STUDIO_ADDRESS.line2}`;

/** Hours the team is reachable, used on the contact page. */
export const SUPPORT_HOURS = '8 AM to 6 PM';
