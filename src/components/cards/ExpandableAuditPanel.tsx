import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/lib/utils";

export interface AuditSection {
  id: string;
  title: string;
  /** One-line verdict shown before expanding. */
  summary: string;
  tone?: Tone;
  badge?: string;
  children: React.ReactNode;
}

/**
 * Progressive disclosure for technical output: verdicts up front,
 * raw detail only when a section is expanded.
 */
export function ExpandableAuditPanel({ sections }: { sections: AuditSection[] }) {
  return (
    <Accordion type="multiple" className="flex flex-col gap-3">
      {sections.map((s) => (
        <AccordionItem key={s.id} value={s.id}>
          <AccordionTrigger>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{s.title}</span>
              {s.badge && <Badge tone={s.tone ?? "neutral"}>{s.badge}</Badge>}
              <span className="w-full truncate text-xs font-normal text-slate-400 sm:w-auto sm:flex-1">
                {s.summary}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>{s.children}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
