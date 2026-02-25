import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { motion } from "framer-motion";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Privacy() {
  usePageMeta('Privacy Policy | LessonLoop', 'How LessonLoop collects, uses, and protects your data');
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

            <div className="prose prose-slate dark:prose-invert max-w-none">
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Introduction</h2>
              <p className="text-muted-foreground mb-4">
                LessonLoop ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our music lesson scheduling and billing platform at lessonloop.net.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. Information We Collect</h2>
              <p className="text-muted-foreground mb-4">We collect information that you provide directly to us, including:</p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Account information (name, email address, password)</li>
                <li>Profile information (phone number, organisation details)</li>
                <li>Student and guardian contact details</li>
                <li>Lesson scheduling and attendance data</li>
                <li>Payment and billing information</li>
                <li>Communications between teachers, students, and guardians</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. Google API Services</h2>
              <p className="text-muted-foreground mb-4">
                LessonLoop uses Google API Services to provide authentication and calendar integration features. Our use and transfer of information received from Google APIs adheres to the{" "}
                <a 
                  href="https://developers.google.com/terms/api-services-user-data-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>

              <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">3.1 Google Sign-In</h3>
              <p className="text-muted-foreground mb-4">
                When you choose to sign in with Google, we access the following information from your Google account:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li><strong>Email address:</strong> Used to create and identify your LessonLoop account</li>
                <li><strong>Name:</strong> Used to personalise your profile</li>
                <li><strong>Profile picture:</strong> Optionally displayed on your account</li>
              </ul>
              <p className="text-muted-foreground mb-4">
                This information is only used to authenticate you and create your account. We do not share this information with third parties except as described in this policy.
              </p>

              <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">3.2 Google Calendar Integration</h3>
              <p className="text-muted-foreground mb-4">
                If you choose to connect your Google Calendar, we access the following:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li><strong>Calendar events:</strong> We read your calendar to check for scheduling conflicts</li>
                <li><strong>Create/update events:</strong> We create lesson events in your calendar and update them when lessons change</li>
                <li><strong>Delete events:</strong> We remove calendar events when lessons are cancelled</li>
              </ul>
              <p className="text-muted-foreground mb-4">
                Calendar data is only accessed when you explicitly connect your calendar. You can disconnect your calendar at any time from your account settings, which will revoke our access.
              </p>

              <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">3.3 Data Storage and Security</h3>
              <p className="text-muted-foreground mb-4">
                Google OAuth tokens are encrypted and stored securely. We only request the minimum permissions necessary to provide the calendar synchronisation feature. We do not:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Sell your Google data to third parties</li>
                <li>Use your Google data for advertising purposes</li>
                <li>Access your Google data for any purpose other than providing LessonLoop services</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. How We Use Your Information</h2>
              <p className="text-muted-foreground mb-4">We use the information we collect to:</p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Synchronise your lessons with your calendar (if connected)</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Develop new features and services</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Data Sharing</h2>
              <p className="text-muted-foreground mb-4">
                We do not sell your personal information. We may share your information with:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li><strong>Service providers:</strong> Third-party services that help us operate our platform (e.g., payment processing, email delivery, cloud hosting)</li>
                <li><strong>Within your organisation:</strong> Other members of your music school or teaching organisation as required for the service</li>
                <li><strong>Legal requirements:</strong> When required by law or to protect our rights</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Data Retention</h2>
              <p className="text-muted-foreground mb-4">
                We retain your personal data for as long as your account is active or as needed to provide you services. Financial records are retained for 7 years as required by UK tax law. You may request deletion of your data at any time, subject to legal retention requirements.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">7. Data Security</h2>
              <p className="text-muted-foreground mb-4">
                We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, alteration, disclosure, or destruction. This includes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Encryption in transit (TLS 1.3) and at rest (AES-256)</li>
                <li>Row-level security policies to isolate organisation data</li>
                <li>Regular security audits and monitoring</li>
                <li>Secure OAuth token storage</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">8. Your Rights Under UK GDPR</h2>
              <p className="text-muted-foreground mb-4">
                Under UK GDPR, you have the following rights:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li><strong>Right of access:</strong> Request a copy of your personal data</li>
                <li><strong>Right to rectification:</strong> Correct inaccurate personal data</li>
                <li><strong>Right to erasure:</strong> Request deletion of your personal data</li>
                <li><strong>Right to restrict processing:</strong> Limit how we use your data</li>
                <li><strong>Right to data portability:</strong> Receive your data in a portable format</li>
                <li><strong>Right to object:</strong> Object to processing of your personal data</li>
              </ul>
              <p className="text-muted-foreground mb-4">
                To exercise these rights, please contact us at privacy@lessonloop.net.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">9. Revoking Access</h2>
              <p className="text-muted-foreground mb-4">
                You can revoke LessonLoop's access to your Google account at any time:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li><strong>Calendar access:</strong> Disconnect from Settings → Calendar in LessonLoop</li>
                <li><strong>Google Sign-In:</strong> Remove access via your{" "}
                  <a 
                    href="https://myaccount.google.com/permissions" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google Account permissions
                  </a>
                </li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">10. Children's Privacy</h2>
              <p className="text-muted-foreground mb-4">
                LessonLoop may store information about students who are minors. This data is managed by teachers and guardians who are responsible for obtaining appropriate consent. We do not knowingly collect personal information directly from children under 13.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">11. Changes to This Policy</h2>
              <p className="text-muted-foreground mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">12. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Email: privacy@lessonloop.net</li>
                <li>Website: lessonloop.net/contact</li>
              </ul>

              <div className="mt-8 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  LessonLoop's use and transfer to any other app of information received from Google APIs will adhere to{" "}
                  <a 
                    href="https://developers.google.com/terms/api-services-user-data-policy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google API Services User Data Policy
                  </a>
                  , including the Limited Use requirements.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
