interface FAQ {
  question: string;
  answer: string;
}

interface UseCaseSchemaProps {
  name: string;
  description: string;
  canonical: string;
  breadcrumbName: string;
  faqs: FAQ[];
}

export default function UseCaseSchema({ name, description, canonical, breadcrumbName, faqs }: UseCaseSchemaProps) {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LessonLoop",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "GBP",
      description: "30-day free trial",
    },
    featureList: name,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://lessonloop.co.uk/" },
      { "@type": "ListItem", position: 2, name: "Use Cases", item: "https://lessonloop.co.uk/for" },
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}
    </>
  );
}
