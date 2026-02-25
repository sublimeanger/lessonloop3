export function FeaturesSchema() {
  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LessonLoop",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Music School Management",
    operatingSystem: "Web",
    url: "https://lessonloop.co.uk/features",
    description:
      "Complete music school management software with scheduling, automated invoicing, parent portal, AI assistant, attendance tracking, practice tracking, multi-location support, and comprehensive reporting. Built for UK music educators.",
    featureList: [
      "Drag-and-Drop Lesson Calendar",
      "Recurring Lesson Patterns",
      "Conflict Detection for Teachers and Rooms",
      "Multi-Location Room Booking",
      "Closure Date and Term Management",
      "Flexible Lesson Durations with Rate Cards",
      "Bulk Invoice Generation",
      "Stripe Online Payment Processing",
      "Automatic Payment Reminders",
      "UK VAT Calculation",
      "PDF Invoice Download",
      "Payment Plans and Installments",
      "Parent Portal with Self-Service",
      "Practice Tracking with Streak Gamification",
      "Lesson Notes Shared with Parents",
      "Reschedule and Cancellation Request Workflow",
      "LoopAssist AI Assistant",
      "Natural Language Data Queries",
      "AI-Drafted Messages and Emails",
      "Automatic Make-Up Lesson Matching",
      "Make-Up Credit Tracking",
      "Student Profile Management",
      "Teacher Management with Role Permissions",
      "Attendance Tracking",
      "Payroll Reports by Teacher",
      "Revenue and Financial Reports",
      "Resource Library for Teaching Materials",
      "In-App Messaging",
      "Smart Email Notifications",
      "GDPR Compliance with Data Export",
      "Audit Logging",
      "Custom Email Templates",
    ],
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "79",
      priceCurrency: "GBP",
    },
    author: {
      "@type": "Organization",
      name: "LessonLoop",
      url: "https://lessonloop.co.uk",
    },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://lessonloop.co.uk" },
      { "@type": "ListItem", position: 2, name: "Features", item: "https://lessonloop.co.uk/features" },
    ],
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What features does LessonLoop include?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "LessonLoop includes over 50 features built for music schools: drag-and-drop lesson scheduling with conflict detection, automated invoicing with Stripe payments, a parent portal with practice tracking and lesson notes, an AI assistant called LoopAssist, make-up lesson matching, multi-location room booking, attendance tracking, teacher management with role-based permissions, payroll and revenue reports, a resource library for sharing teaching materials, and in-app messaging. Every feature is designed specifically for music educators.",
        },
      },
      {
        "@type": "Question",
        name: "Does LessonLoop have a parent portal?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. LessonLoop's parent portal gives families self-service access to their child's lesson schedule, invoice payments via Stripe, practice tracking with streak gamification, lesson notes from teachers, a resource library, and the ability to submit reschedule or cancellation requests. Parents receive email notifications and can message the school directly through the portal.",
        },
      },
      {
        "@type": "Question",
        name: "What is LoopAssist?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "LoopAssist is LessonLoop's built-in AI assistant. You can ask it questions about your school in plain English — such as 'Who has overdue invoices?' or 'What's my revenue this term?' — and it analyses your data to give you answers instantly. It can also draft messages, summarise attendance, and suggest actions. Every action requires your confirmation before executing. LoopAssist is included on every LessonLoop plan at no extra cost.",
        },
      },
      {
        "@type": "Question",
        name: "Can LessonLoop handle invoicing and payments for music schools?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. LessonLoop handles the full invoicing workflow: generate invoices individually or in bulk for an entire term, send them automatically to parents with payment links, accept online card payments via Stripe, send automatic overdue reminders, and track outstanding balances. It supports UK VAT calculation, payment plans with installments, rate cards with per-duration pricing, and professional PDF invoice downloads.",
        },
      },
      {
        "@type": "Question",
        name: "How does LessonLoop compare to My Music Staff and Teachworks?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "LessonLoop offers several features that My Music Staff and Teachworks do not: an AI assistant (LoopAssist) on every plan, automatic make-up lesson matching, payment plans with installments, and a modern responsive interface. LessonLoop is also built natively for UK music schools with GBP billing, UK VAT support, term date awareness, and GDPR compliance by design.",
        },
      },
      {
        "@type": "Question",
        name: "Does LessonLoop support multiple locations?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. LessonLoop supports multi-location management with room booking and availability tracking across venues. You can filter the calendar by location, assign teachers to specific venues, and manage room conflicts.",
        },
      },
      {
        "@type": "Question",
        name: "Is LessonLoop secure and GDPR compliant?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. LessonLoop is built with GDPR compliance by design. It includes 256-bit SSL encryption, complete audit logging, data export functionality, configurable data retention policies with automatic anonymisation, and role-based access controls. LessonLoop is built and headquartered in the UK.",
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
