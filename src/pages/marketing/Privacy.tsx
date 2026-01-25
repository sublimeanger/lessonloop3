import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { motion } from "framer-motion";

export default function Privacy() {
  return (
    <MarketingLayout>
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero-light" />
        
        <div className="container mx-auto px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Privacy Policy
            </h1>
            <p className="text-muted-foreground mb-8">
              Last updated: January 2025
            </p>

            <div className="prose prose-slate max-w-none">
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Introduction</h2>
              <p className="text-muted-foreground mb-4">
                LessonLoop ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our music lesson scheduling and billing platform.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. Information We Collect</h2>
              <p className="text-muted-foreground mb-4">We collect information that you provide directly to us, including:</p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Account information (name, email, password)</li>
                <li>Student and guardian contact details</li>
                <li>Lesson scheduling and attendance data</li>
                <li>Payment and billing information</li>
                <li>Communications between teachers, students, and guardians</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. How We Use Your Information</h2>
              <p className="text-muted-foreground mb-4">We use the information we collect to:</p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Develop new features and services</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. Data Sharing</h2>
              <p className="text-muted-foreground mb-4">
                We do not sell your personal information. We may share your information with third-party service providers who perform services on our behalf, such as payment processing and email delivery.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Data Security</h2>
              <p className="text-muted-foreground mb-4">
                We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, alteration, disclosure, or destruction.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Your Rights</h2>
              <p className="text-muted-foreground mb-4">
                Under UK GDPR, you have the right to access, correct, delete, or port your personal data. You may also object to processing or request restriction of processing. Contact us to exercise these rights.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">7. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy, please contact us at privacy@lessonloop.net.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
