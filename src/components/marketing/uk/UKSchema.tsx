const softwareApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LessonLoop",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Music School Management",
  operatingSystem: "Web",
  url: "https://lessonloop.co.uk/uk",
  description: "Music school management software built natively for UK educators. Features include GBP billing with automatic UK VAT calculation, termly scheduling with UK bank holidays, GDPR compliance by design with data export and audit logging, parent portal, AI assistant, and comprehensive reporting. Headquartered in Surrey, United Kingdom.",
  countryOfOrigin: { "@type": "Country", name: "United Kingdom" },
  inLanguage: "en-GB",
  offers: { "@type": "AggregateOffer", lowPrice: "0", highPrice: "79", priceCurrency: "GBP", offerCount: "3" },
  author: {
    "@type": "Organization",
    name: "LessonLoop",
    url: "https://lessonloop.co.uk",
    address: { "@type": "PostalAddress", streetAddress: "Tanglewood Offices, Burhill Road", addressLocality: "Hersham", addressRegion: "Surrey", postalCode: "KT12 4BJ", addressCountry: "GB" },
  },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://lessonloop.co.uk" },
    { "@type": "ListItem", position: 2, name: "UK Music Schools", item: "https://lessonloop.co.uk/uk" },
  ],
};

const faq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "Is there a music school software built for the UK?", acceptedAnswer: { "@type": "Answer", text: "Yes. LessonLoop is music school management software built natively in the UK for UK music educators. It uses GBP billing, calculates UK VAT automatically on every invoice, supports termly scheduling with UK bank holidays, and is GDPR compliant by design. The company is headquartered in Surrey, England." } },
    { "@type": "Question", name: "Does LessonLoop support UK VAT on invoices?", acceptedAnswer: { "@type": "Answer", text: "Yes. LessonLoop automatically calculates and applies UK VAT to every invoice. VAT amounts are itemised on PDF invoices and payment receipts, making them HMRC-ready. You can configure your VAT rate in settings." } },
    { "@type": "Question", name: "Can LessonLoop handle termly billing?", acceptedAnswer: { "@type": "Answer", text: "Yes. LessonLoop supports termly scheduling and billing. Set your term dates (autumn, spring, summer), and LessonLoop automatically calculates lesson counts per term, auto-skips half-term breaks and bank holidays, and generates term invoices in bulk. You can also set up payment plans so parents can pay in instalments across the term." } },
    { "@type": "Question", name: "Is LessonLoop GDPR compliant?", acceptedAnswer: { "@type": "Answer", text: "Yes. LessonLoop is GDPR compliant by design — not retrofitted. Features include data export for Subject Access Requests, configurable data retention policies, automatic anonymisation of old records, audit logging of all data access, soft delete for student records, and role-based access controls. Built and headquartered in the UK." } },
    { "@type": "Question", name: "Does LessonLoop use British English?", acceptedAnswer: { "@type": "Answer", text: "Yes. LessonLoop uses British English throughout — colour not color, organised not organized, licence not license. All dates are in DD/MM/YYYY format. Currency is displayed in GBP. Time is in GMT/BST with no UTC confusion." } },
    { "@type": "Question", name: "How does LessonLoop compare to US-based music school software?", acceptedAnswer: { "@type": "Answer", text: "Most music school software (My Music Staff, Teachworks, Opus1, Jackrabbit Music) is built in the US or Canada. They use USD by default, don't understand UK VAT or termly billing, don't skip UK bank holidays, and treat GDPR as an add-on rather than a core design principle. LessonLoop is the only music school software built natively for the UK market with all of these features included on every plan." } },
    { "@type": "Question", name: "Does LessonLoop handle UK bank holidays automatically?", acceptedAnswer: { "@type": "Answer", text: "Yes. UK bank holidays (England, Wales, Scotland, Northern Ireland) are built into LessonLoop from day one. Recurring lessons automatically skip bank holidays, and the calendar clearly marks them. No manual setup required." } },
    { "@type": "Question", name: "How much does LessonLoop cost for UK music schools?", acceptedAnswer: { "@type": "Answer", text: "LessonLoop starts at £12 per month for solo teachers, £29 per month for multi-teacher studios, and £79 per month for agencies. All prices are in GBP with no currency conversion. Annual billing saves approximately 17%. Every plan includes a 30-day free trial with no credit card required." } },
  ],
};

export function UKSchema() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApp) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
    </>
  );
}
