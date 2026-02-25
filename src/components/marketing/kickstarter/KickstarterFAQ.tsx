import { motion } from "framer-motion";
import { HelpCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Is LessonLoop actually built, or is this just an idea?",
    a: "It's built and functional right now. The core platform — scheduling, invoicing, parent portal, and LoopAssist AI — is live and being used. Kickstarter funds will go towards scaling infrastructure, building mobile apps, and enhancing the AI capabilities.",
  },
  {
    q: "When will I get access to my reward?",
    a: "All backers will receive early access in July 2026 once the campaign successfully funds. Lifetime and Early Bird plan backers will have their accounts activated immediately upon fulfilment.",
  },
  {
    q: "What if the campaign doesn't reach its goal?",
    a: "This is an all-or-nothing campaign. If we don't hit £18,500, no one is charged and all pledges are returned. We only move forward if there's enough support to deliver on our promises.",
  },
  {
    q: "What does 'Lifetime' actually mean?",
    a: "Lifetime means for as long as LessonLoop exists as a product. You'll never pay a subscription fee. All future features, updates, and improvements are included at no additional cost.",
  },
  {
    q: "Can I upgrade my tier after backing?",
    a: "Yes! Kickstarter allows you to change your pledge at any time before the campaign ends. After the campaign, contact us and we'll help you upgrade.",
  },
  {
    q: "Is LessonLoop only for piano teachers?",
    a: "Not at all! While our founder is a piano teacher, LessonLoop works for any instrument, voice coaching, music theory, and even multi-teacher studios and agencies. If you teach music, it's built for you.",
  },
  {
    q: "What about my data and privacy?",
    a: "We take data protection seriously. LessonLoop is fully GDPR-compliant, hosted on secure European infrastructure, with encryption at rest and in transit. You own your data, always.",
  },
  {
    q: "Do I need to pay for shipping?",
    a: "No! All rewards are digital — software licences, badges, and access. There's nothing to ship, so there are no shipping costs anywhere in the world.",
  },
];

export function KickstarterFAQ() {
  return (
    <section className="py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
        backgroundSize: "32px 32px",
      }} />

      <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6">
            <HelpCircle className="w-4 h-4" />
            FAQ
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-card border border-border/60 rounded-xl px-6 data-[state=open]:shadow-lg data-[state=open]:border-primary/20 transition-all"
              >
                <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-5 [&[data-state=open]>svg]:rotate-180">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Cross-links */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm"
        >
          <Link to="/pricing" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            View plans and pricing <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <span className="w-px h-4 bg-border hidden sm:block" />
          <Link to="/features" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            Explore all features <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <span className="w-px h-4 bg-border hidden sm:block" />
          <Link to="/contact" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            Contact us <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
