import { motion } from "framer-motion";
import { HelpCircle, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    category: "Trial & Getting Started",
    items: [
      {
        question: "Is there a free trial?",
        answer: "Yes! All plans include a 14-day free trial with full access to all features. No credit card required to start. You can explore everything LessonLoop offers before making any commitment.",
      },
      {
        question: "What happens after my trial ends?",
        answer: "At the end of your trial, you'll be prompted to choose a plan. If you don't subscribe, your account will be paused (not deleted), and you can pick up right where you left off when you're ready.",
      },
    ],
  },
  {
    category: "Billing & Payments",
    items: [
      {
        question: "Can I change plans later?",
        answer: "Absolutely. You can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, changes take effect on your next billing cycle.",
      },
      {
        question: "Is there a discount for annual billing?",
        answer: "Yes! Annual subscriptions receive 2 months free (16% discount). This is automatically applied when you select annual billing. We also offer custom pricing for large academies.",
      },
      {
        question: "What payment methods do you accept?",
        answer: "We accept all major credit and debit cards via Stripe, including Visa, Mastercard, and American Express. For annual subscriptions, we also support Direct Debit and bank transfers.",
      },
      {
        question: "Can I cancel anytime?",
        answer: "Yes, you can cancel your subscription at any time. There are no cancellation fees or long-term contracts. You'll continue to have access until the end of your current billing period.",
      },
    ],
  },
  {
    category: "Features & Support",
    items: [
      {
        question: "Do you offer discounts for charities or schools?",
        answer: "Yes! We offer special pricing for registered charities, non-profits, and educational institutions. Contact our team to learn more about our education pricing.",
      },
      {
        question: "Is my data secure?",
        answer: "Absolutely. We use bank-level encryption (AES-256), are fully GDPR compliant, and never share your data with third parties. Your student and financial data is protected by enterprise-grade security.",
      },
      {
        question: "What support do I get?",
        answer: "Solo plan includes email support with 24-hour response times. Academy plan adds priority support and live chat. Agency plan includes a dedicated account manager and phone support.",
      },
    ],
  },
];

export function PricingFAQ() {
  return (
    <section className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 lg:mb-16"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
            <HelpCircle className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about our pricing and plans
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto space-y-8">
          {faqs.map((category, categoryIndex) => (
            <motion.div
              key={category.category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: categoryIndex * 0.1 }}
            >
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
                {category.category}
              </h3>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((faq, faqIndex) => (
                    <AccordionItem 
                      key={faq.question} 
                      value={`${categoryIndex}-${faqIndex}`}
                      className="border-b border-border last:border-0"
                    >
                      <AccordionTrigger className="px-6 py-4 text-left font-medium text-foreground hover:no-underline hover:bg-muted/50 transition-colors">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-4 text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-muted-foreground mb-4">
            Still have questions?
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-muted/50 hover:border-primary/30 transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            Get in touch
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
