export default function ContactSchema() {
  const contactPageSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact LessonLoop",
    description:
      "Get in touch with LessonLoop — music school management software for UK educators. We typically respond within 24 hours.",
    url: "https://lessonloop.co.uk/contact",
    mainEntity: {
      "@type": "Organization",
      name: "LessonLoop",
      email: "hello@lessonloop.net",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@lessonloop.net",
        availableLanguage: "English",
        hoursAvailable: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          opens: "09:00",
          closes: "17:00",
        },
      },
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://lessonloop.co.uk/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Contact",
        item: "https://lessonloop.co.uk/contact",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
