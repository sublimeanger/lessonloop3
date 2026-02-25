import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { motion } from "framer-motion";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Video, Plus, Settings, Trash2, Shield, HelpCircle } from "lucide-react";

export default function ZoomGuide() {
  usePageMeta(
    "Zoom Integration Guide | LessonLoop",
    "Learn how to connect, use, and remove the Zoom integration in LessonLoop for automatic online lesson meeting links."
  );

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
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-[#2D8CFF] flex items-center justify-center">
                <Video className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground">
                Zoom Integration Guide
              </h1>
            </div>
            <p className="text-muted-foreground mb-8">
              Last updated: February 2026
            </p>

            <div className="prose prose-slate dark:prose-invert max-w-none">
              {/* Overview */}
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4 flex items-center gap-2">
                Overview
              </h2>
              <p className="text-muted-foreground mb-4">
                LessonLoop's Zoom integration automatically creates unique Zoom meeting links whenever you schedule an online lesson. Parents and students see the join link directly in their portal — no manual copy-pasting required.
              </p>

              {/* Adding / Connecting */}
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Adding the Zoom Integration
              </h2>
              <ol className="text-muted-foreground space-y-3 list-decimal list-inside mb-4">
                <li>
                  Log in to LessonLoop and navigate to <strong>Settings → Zoom Meetings</strong>.
                </li>
                <li>
                  Click the <strong>"Connect"</strong> button next to the Zoom Account card.
                </li>
                <li>
                  You will be redirected to Zoom's authorisation page. Sign in with your Zoom account and click <strong>"Allow"</strong> to grant LessonLoop access.
                </li>
                <li>
                  Once authorised, you will be redirected back to LessonLoop. A green <strong>"Connected"</strong> badge confirms the integration is active.
                </li>
              </ol>
              <p className="text-muted-foreground mb-4">
                <strong>Requirements:</strong> You need a Zoom account (free or paid). The account owner or admin must authorise the connection. Only one Zoom account can be connected per organisation at a time.
              </p>

              {/* Using */}
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Using the Zoom Integration
              </h2>
              <h3 className="text-xl font-medium text-foreground mt-6 mb-3">
                Automatic Meeting Creation
              </h3>
              <p className="text-muted-foreground mb-4">
                Once connected, toggle <strong>"Auto-create Meetings"</strong> on in Settings → Zoom Meetings. After that:
              </p>
              <ol className="text-muted-foreground space-y-3 list-decimal list-inside mb-4">
                <li>Create or edit a lesson and select <strong>"Online Lesson"</strong> as the lesson type.</li>
                <li>LessonLoop automatically creates a dedicated Zoom meeting and attaches the join link to the lesson.</li>
                <li>Parents and students see the <strong>"Join Zoom"</strong> button in their portal for upcoming online lessons.</li>
                <li>If a lesson is cancelled, the corresponding Zoom meeting is automatically removed.</li>
              </ol>

              <h3 className="text-xl font-medium text-foreground mt-6 mb-3">
                What Data Is Accessed
              </h3>
              <p className="text-muted-foreground mb-4">
                LessonLoop accesses the following from your Zoom account:
              </p>
              <ul className="text-muted-foreground space-y-2 list-disc list-inside mb-4">
                <li><strong>User profile:</strong> Your Zoom display name and email (shown in Settings to confirm which account is connected).</li>
                <li><strong>Meeting management:</strong> Creating and deleting meetings on your behalf for online lessons only.</li>
              </ul>
              <p className="text-muted-foreground mb-4">
                LessonLoop does <strong>not</strong> access your meeting recordings, chat messages, contacts, or any other Zoom data beyond what is listed above.
              </p>

              {/* Removing */}
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                Removing the Zoom Integration
              </h2>
              <h3 className="text-xl font-medium text-foreground mt-6 mb-3">
                From LessonLoop
              </h3>
              <ol className="text-muted-foreground space-y-3 list-decimal list-inside mb-4">
                <li>Go to <strong>Settings → Zoom Meetings</strong>.</li>
                <li>Click the <strong>"Disconnect"</strong> button.</li>
                <li>Confirm the disconnection in the dialog that appears.</li>
                <li>LessonLoop immediately deletes your stored Zoom tokens. Existing Zoom meeting links on past lessons are preserved for reference but no new meetings will be created.</li>
              </ol>
              <h3 className="text-xl font-medium text-foreground mt-6 mb-3">
                From Zoom
              </h3>
              <p className="text-muted-foreground mb-4">
                You can also revoke access directly from your Zoom account:
              </p>
              <ol className="text-muted-foreground space-y-3 list-decimal list-inside mb-4">
                <li>Log in to <a href="https://marketplace.zoom.us" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">marketplace.zoom.us</a>.</li>
                <li>Go to <strong>Manage → Installed Apps</strong>.</li>
                <li>Find <strong>LessonLoop</strong> and click <strong>"Uninstall"</strong>.</li>
              </ol>
              <p className="text-muted-foreground mb-4">
                When you uninstall from Zoom, LessonLoop will no longer be able to create meetings on your behalf. We recommend also disconnecting from within LessonLoop Settings for a clean removal.
              </p>

              {/* Data & Privacy */}
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Data Handling &amp; Privacy
              </h2>
              <ul className="text-muted-foreground space-y-3 list-disc list-inside mb-4">
                <li>OAuth tokens are stored encrypted and are never exposed to the browser.</li>
                <li>Tokens are used solely to create and manage Zoom meetings for your online lessons.</li>
                <li>When you disconnect, all stored tokens are permanently deleted.</li>
                <li>LessonLoop does not sell, share, or use your Zoom data for advertising or any purpose other than the integration described above.</li>
                <li>For full details, see our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.</li>
              </ul>

              {/* Support */}
              <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Need Help?
              </h2>
              <p className="text-muted-foreground mb-4">
                If you experience any issues with the Zoom integration, please <a href="/contact" className="text-primary hover:underline">contact our support team</a>. We're happy to help with setup, troubleshooting, or data-related questions.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
