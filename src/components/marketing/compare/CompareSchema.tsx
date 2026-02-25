interface FAQ {
  question: string;
  answer: string;
}

interface CompareSchemaProps {
  competitorName: string;
  canonical: string;
  breadcrumbName: string;
  faqs: FAQ[];
}

export default function CompareSchema({ competitorName, canonical, breadcrumbName, faqs }: CompareSchemaProps) {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://lessonloop.co.uk/" },
      { "@type": "ListItem", position: 2, name: "Compare", item: "https://lessonloop.co.uk/compare" },
      { "@type": "ListItem", position: 3, name: breadcrumbName, item: canonical },
    ],
  };

  const faqSchema = faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LessonLoop",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: `LessonLoop vs ${competitorName} — compare features, pricing, and UK suitability for music lesson management.`,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "GBP",
      description: "30-day free trial",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}
    </>
  );
}
