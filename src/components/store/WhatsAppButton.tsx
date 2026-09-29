import { publicEnv } from '@/lib/env';

/** WhatsApp's glyph — lucide dropped brand marks, so it is inlined here. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" />
      <path d="M12.04 2C6.6 2 2.18 6.42 2.18 11.86c0 1.74.46 3.44 1.32 4.94L2.1 22l5.34-1.38a9.82 9.82 0 0 0 4.6 1.16h.01c5.43 0 9.85-4.42 9.85-9.86 0-2.63-1.02-5.11-2.88-6.97A9.8 9.8 0 0 0 12.04 2Zm0 17.93h-.01a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.15 8.15 0 0 1-1.25-4.35c0-4.52 3.68-8.19 8.2-8.19a8.15 8.15 0 0 1 8.18 8.2c0 4.52-3.68 8.18-8.19 8.18Z" />
    </svg>
  );
}

/**
 * Floating WhatsApp chat launcher. Rendered once from the store layout so it
 * follows the customer across every storefront page.
 */
export function WhatsAppButton() {
  const number = publicEnv.whatsappNumber.replace(/[^0-9]/g, '');
  if (!number) return null;

  const href = `https://wa.me/${number}?text=${encodeURIComponent(
    'Hi Dartler! I have a question about your products.',
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      // Sits below the header (z-50) and any drawer, so it never traps a modal.
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-0 rounded-full bg-[#25D366] py-3.5 pl-3.5 pr-3.5 text-white shadow-[0_10px_30px_-8px_rgba(37,211,102,0.6)] transition-all duration-300 ease-smooth hover:gap-2 hover:pr-5 hover:shadow-[0_14px_36px_-8px_rgba(37,211,102,0.75)] focus-visible:ring-offset-0 sm:bottom-7 sm:right-7"
    >
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-20 [animation-duration:2.6s]" />
      <WhatsAppGlyph className="h-6 w-6 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium transition-[max-width] duration-300 ease-smooth group-hover:max-w-[9rem]">
        Chat with us
      </span>
    </a>
  );
}
