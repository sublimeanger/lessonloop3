export default function AboutSchema() {
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LessonLoop",
    url: "https://lessonloop.co.uk",
    logo: "https://lessonloop.co.uk/logo.png",
    description:
      "Music school management software built for UK educators. Scheduling, invoicing, attendance, and parent communication — designed by a music teacher with 20 years of experience.",
    founder: {
      "@type": "Person",
      name: "Lauren Twilley",
      jobTitle: "Founder",
    },
    foundingDate: "2024",
    areaServed: {
      "@type": "Country",
      name: "United Kingdom",
    },
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@lessonloop.net",
      contactType: "customer support",
      availableLanguage: "English",
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
        name: "About",
        item: "https://lessonloop.co.uk/about",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
