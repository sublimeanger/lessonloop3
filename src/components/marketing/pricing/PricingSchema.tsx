export function PricingSchema() {
  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LessonLoop",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Music School Management",
    operatingSystem: "Web",
    url: "https://lessonloop.co.uk/pricing",
    description:
      "Music school management software with scheduling, automated invoicing, parent portal, AI assistant, and 50+ features. Plans for solo teachers, multi-teacher studios, and large academies.",
    offers: [
      {
        "@type": "Offer",
        name: "Teacher",
        description:
          "For independent music educators. Unlimited students, scheduling, invoicing, parent portal, practice tracking, LoopAssist AI, and email support.",
        price: "12",
        priceCurrency: "GBP",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "12",
          priceCurrency: "GBP",
          unitText: "MONTH",
          referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
        },
        eligibleQuantity: { "@type": "QuantitativeValue", value: "1", unitText: "teacher" },
      },
      {
        "@type": "Offer",
        name: "Studio",
        description:
          "For music schools and growing teams. Everything in Teacher plus multi-location, up to 5 teachers, bulk invoicing, team scheduling, payroll reports, custom branding, and priority support.",
        price: "29",
        priceCurrency: "GBP",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "29",
          priceCurrency: "GBP",
          unitText: "MONTH",
          referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
        },
        eligibleQuantity: { "@type": "QuantitativeValue", value: "5", unitText: "teachers" },
      },
      {
        "@type": "Offer",
        name: "Agency",
        description:
          "For teaching agencies and large academies. Everything in Studio plus unlimited teachers, API access, SSO/SAML, dedicated account manager, custom integrations, white-label options, and SLA guarantee.",
        price: "79",
        priceCurrency: "GBP",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "79",
          priceCurrency: "GBP",
          unitText: "MONTH",
          referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
        },
      },
    ],
    author: { "@type": "Organization", name: "LessonLoop", url: "https://lessonloop.co.uk" },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://lessonloop.co.uk" },
      { "@type": "ListItem", position: 2, name: "Pricing", item: "https://lessonloop.co.uk/pricing" },
    ],
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does LessonLoop cost?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "LessonLoop starts at £12 per month for solo teachers (Teacher plan), £29 per month for multi-teacher studios (Studio plan), and £79 per month for agencies and large academies (Agency plan). Annual billing saves approximately 17%. All plans include a 30-day free trial with no credit card required.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a free trial?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. All plans include a 30-day free trial with full access to all features. No credit card required — just sign up and start using LessonLoop immediately.",
        },
      },
      {
        "@type": "Question",
        name: "What happens after my trial ends?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "At the end of your trial, you'll need to add a payment method to continue. We send friendly reminders before your trial ends. If you don't upgrade, your account is paused (not deleted), and you can resume right where you left off.",
        },
      },
      {
        "@type": "Question",
        name: "Can I change plans later?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. You can upgrade or downgrade at any time. Upgrades give immediate access to new features. Downgrades take effect on your next billing cycle. There are no penalties for switching.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a discount for annual billing?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Annual subscriptions receive approximately 2 months free (around 17% discount). This is automatically applied when you select annual billing. Custom pricing is also available for large academies and agencies.",
        },
      },
      {
        "@type": "Question",
        name: "What payment methods do you accept?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "LessonLoop accepts all major credit and debit cards via Stripe, including Visa, Mastercard, and American Express. For annual subscriptions, Direct Debit and bank transfers are also available.",
        },
      },
      {
        "@type": "Question",
        name: "Can I cancel anytime?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Cancel at any time with no cancellation fees or long-term contracts. You keep access until the end of your current billing period.",
        },
      },
      {
        "@type": "Question",
        name: "Is LoopAssist AI included in all plans?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. LoopAssist AI is included on every LessonLoop plan at no extra cost — Teacher, Studio, and Agency. There are no add-on fees for AI features.",
        },
      },
      {
        "@type": "Question",
        name: "Is my data secure?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. LessonLoop uses AES-256 encryption, is fully GDPR compliant, and never shares your data with third parties. Built and headquartered in the UK with enterprise-grade security on every plan.",
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApp) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
    </>
  );
}
