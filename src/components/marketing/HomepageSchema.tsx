export function HomepageSchema() {
  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LessonLoop",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Music School Management",
    operatingSystem: "Web",
    description:
      "Music school management software for UK academies. Scheduling, billing, parent portal, attendance tracking, practice logs, and AI-powered insights.",
    url: "https://lessonloop.co.uk",
    screenshot: "https://lessonloop.co.uk/og-home.png",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "79",
      priceCurrency: "GBP",
      offerCount: "3",
      offers: [
        {
          "@type": "Offer",
          name: "Free Trial",
          price: "0",
          priceCurrency: "GBP",
          description: "30-day free trial with no credit card required",
        },
      ],
    },
    featureList: [
      "Drag-and-Drop Lesson Scheduling",
      "Automated Invoicing & Billing",
      "Parent Portal with Practice Tracking",
      "Student & Teacher Management",
      "Attendance Tracking",
      "LoopAssist AI Assistant",
      "Multi-Location Management",
      "Reports & Analytics",
      "In-App Messaging",
      "Resource Sharing Library",
      "Stripe Payment Processing",
      "GDPR Compliance Built In",
      "UK Term Dates & Bank Holidays",
      "Make-Up Lesson Matching",
    ],
    author: {
      "@type": "Organization",
      name: "LessonLoop",
      url: "https://lessonloop.co.uk",
    },
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LessonLoop",
    url: "https://lessonloop.co.uk",
    logo: "https://lessonloop.co.uk/logo.png",
    description:
      "Music school management software built for UK music educators.",
    foundingDate: "2024",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Tanglewood Offices, Burhill Road",
      addressLocality: "Hersham",
      addressRegion: "Surrey",
      postalCode: "KT12 4BJ",
      addressCountry: "GB",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: "English",
      url: "https://lessonloop.co.uk/contact",
    },
    sameAs: [],
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is music school management software?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Music school management software is a platform that helps music teachers and academies manage lesson scheduling, student enrolment, invoicing, parent communication, attendance tracking, and reporting — all in one place. LessonLoop is built specifically for UK music educators with features like termly billing, GDPR compliance, and an AI assistant called LoopAssist.",
        },
      },
      {
        "@type": "Question",
        name: "How much does LessonLoop cost?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "LessonLoop offers a 30-day free trial with no credit card required. Paid plans start from £12/month and scale based on the number of students and features you need. Every plan includes the LoopAssist AI assistant at no extra cost.",
        },
      },
      {
        "@type": "Question",
        name: "Is LessonLoop suitable for solo music teachers or just academies?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "LessonLoop works for both solo music teachers and multi-teacher academies. Solo teachers use it to schedule lessons, send invoices, and share resources with parents. Academies benefit from multi-teacher management, role-based permissions, multi-location support, and advanced reporting.",
        },
      },
      {
        "@type": "Question",
        name: "Does LessonLoop work for UK music schools specifically?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. LessonLoop is built in the UK specifically for UK music educators. It includes GBP billing, UK VAT on invoices, term date awareness with automatic break skipping, UK bank holiday handling, GDPR compliance by design, and London timezone as the default.",
        },
      },
      {
        "@type": "Question",
        name: "What makes LessonLoop different from My Music Staff or Teachworks?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "LessonLoop is the only music school software that includes an AI assistant (LoopAssist) on every plan, is built natively for the UK market with GDPR-first design, and offers a modern parent portal with practice tracking, lesson notes, and reschedule request workflows.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplication) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />
    </>
  );
}
