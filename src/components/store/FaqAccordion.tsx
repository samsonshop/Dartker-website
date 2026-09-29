'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * `headingLevel` defaults to 2: each question is a section directly under the
 * page's `<h1>`, so h3 would skip a level for anyone navigating by heading.
 */
export function FaqAccordion({
  items,
  headingLevel = 2,
}: {
  items: { question: string; answer: string }[];
  headingLevel?: 2 | 3 | 4;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const Heading = `h${headingLevel}` as const;

  return (
    <ul className="divide-y divide-taupe-100 overflow-hidden rounded-2xl border border-taupe-100 bg-white">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <li key={item.question}>
            <Heading>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`faq-panel-${index}`}
                onClick={() => setOpen(expanded ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-charcoal-700 transition-colors hover:bg-ivory-50"
              >
                {item.question}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-charcoal-400 transition-transform duration-200',
                    expanded && 'rotate-180',
                  )}
                />
              </button>
            </Heading>
            <div
              id={`faq-panel-${index}`}
              hidden={!expanded}
              className="px-5 pb-4 text-sm leading-relaxed text-charcoal-500"
            >
              {item.answer}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
