import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Receipt, Users, Sparkles, ChevronRight, RefreshCw, Play, X, Mail, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  loopassistReal, calendarReal, revenueReal, messagesReal, 
  makeupsReal, practiceReal, teachersReal, attendanceReal 
} from "@/assets/marketing";

const tabs = [
  {
    id: "ai",
    label: "AI Assistant",
    icon: Sparkles,
    description: "Your intelligent music school co-pilot",
    features: ["Natural language queries", "Smart actions with confirmation", "Draft messages & emails", "Revenue insights & attendance summaries", "Works across scheduling, billing, practice and attendance"],
    screenshot: loopassistReal,
    alt: "LoopAssist AI assistant interface showing smart suggestions and conversation history",
    url: "/features/loopassist",
    browserUrl: "app.lessonloop.net/loopassist",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: Calendar,
    description: "Drag-and-drop scheduling with conflict detection",
    features: ["Week & day views with drag-and-drop", "Recurring lessons with break skipping", "Room & location booking", "Closure date management", "Teacher availability matching"],
    screenshot: calendarReal,
    alt: "Weekly calendar view with colour-coded lessons across multiple teachers",
    url: "/features/scheduling",
    browserUrl: "app.lessonloop.net/calendar",
  },
  {
    id: "invoices",
    label: "Invoicing",
    icon: Receipt,
    description: "Automated billing with online payments",
    features: ["Termly & monthly bulk generation", "Payment plans & installments", "Stripe online payments", "UK VAT support", "Overdue reminders & automation"],
    screenshot: revenueReal,
    alt: "Revenue report showing £55,195 total revenue with monthly breakdown chart",
    url: "/features/billing",
    browserUrl: "app.lessonloop.net/reports/revenue",
  },
  {
    id: "students",
    label: "Messages",
    icon: Users,
    description: "Parent communication made easy",
    features: ["Threaded conversations", "Cancellation & reschedule requests", "Internal staff messaging", "Search & filter", "Read status tracking"],
    screenshot: messagesReal,
    alt: "Message threads with parent conversations about lessons and scheduling",
    url: "/features/messaging",
    browserUrl: "app.lessonloop.net/messages",
  },
  {
    id: "makeups",
    label: "Make-Ups",
    icon: RefreshCw,
    description: "Never lose revenue from cancellations",
    features: ["Automatic slot detection", "Parent notification", "One-click accept", "Make-up credits"],
    screenshot: makeupsReal,
    alt: "Make-up lesson management with waitlist and credit tracking",
    url: "/features/scheduling",
    browserUrl: "app.lessonloop.net/make-ups",
  },
  {
    id: "practice",
    label: "Practice",
    icon: Play,
    description: "Track and encourage student practice",
    features: ["Create practice assignments", "Streak tracking & gamification", "Parent visibility via portal", "Progress reports"],
    screenshot: practiceReal,
    alt: "Practice tracking dashboard with assignments, review queue, and weekly progress",
    url: "/features/practice-tracking",
    browserUrl: "app.lessonloop.net/practice",
  },
  {
    id: "teachers",
    label: "Teachers",
    icon: Mail,
    description: "Manage your teaching team",
    features: ["Teacher profiles & linking", "Student assignments", "Payroll tracking", "Availability management"],
    screenshot: teachersReal,
    alt: "Teachers list showing 19 linked teachers with student counts",
    url: "/features/teachers",
    browserUrl: "app.lessonloop.net/teachers",
  },
];

function VideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-ink border border-white/10 rounded-2xl p-8 max-w-md w-full text-center relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-teal/20 flex items-center justify-center mx-auto mb-5">
            <Play className="w-8 h-8 text-teal-light ml-1" />
          </div>

          <h3 className="text-xl font-bold text-white mb-2">Video coming soon</h3>
          <p className="text-sm text-white/50 mb-6">
            We're recording product walkthroughs. Get notified when they're ready.
          </p>

          {submitted ? (
            <p className="text-sm text-teal-light font-medium">Thanks! We'll let you know. ✓</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email) setSubmitted(true);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-teal/50"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-teal text-white text-sm font-semibold hover:bg-teal-dark transition-colors shrink-0"
              >
                Notify me
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function ProductShowcase() {
  const [activeTab, setActiveTab] = useState("ai");
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const activeTabData = tabs.find((t) => t.id === activeTab)!;

  return (
    <section id="product-showcase" className="py-24 lg:py-32 bg-ink relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-teal/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-teal-light text-sm font-semibold mb-6">
            The Platform
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
            Everything you need. Nothing you don't.
          </h2>
          <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto">
            LessonLoop replaces your scheduling spreadsheet, invoicing software, messaging apps, and admin notebooks with one integrated music school management platform.
          </p>
        </motion.div>

        {/* Tab Buttons */}
        <div className="relative mb-12">
          {/* Edge fades for mobile scroll */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-ink to-transparent z-10 pointer-events-none lg:hidden" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-ink to-transparent z-10 pointer-events-none lg:hidden" />
          
          <div className="flex gap-3 overflow-x-auto scrollbar-hide flex-nowrap lg:flex-wrap lg:justify-center px-4 -mx-4 lg:mx-0 lg:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all flex-shrink-0",
                  activeTab === tab.id
                    ? "bg-white text-ink shadow-xl"
                    : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Info Side */}
          <motion.div
            key={activeTab + "-info"}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="order-2 lg:order-1"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center">
                <activeTabData.icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{activeTabData.label}</h3>
                <p className="text-white/60">{activeTabData.description}</p>
              </div>
            </div>
            
            <ul className="space-y-4">
              {activeTabData.features.map((feature, i) => (
                <motion.li
                  key={feature}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 text-white/80"
                >
                  <div className="w-6 h-6 rounded-full bg-teal/20 flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 text-teal-light" />
                  </div>
                  {feature}
                </motion.li>
              ))}
            </ul>

            <Link
              to={activeTabData.url}
              className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-teal-light hover:gap-2.5 transition-all"
            >
              Learn more <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Screenshot Side */}
          <div className="order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              {/* Browser Frame */}
              <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
                {/* Browser Bar */}
                <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/80" />
                    <div className="w-3 h-3 rounded-full bg-warning/80" />
                    <div className="w-3 h-3 rounded-full bg-success/80" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-white/10 rounded-lg px-4 py-1 text-xs text-white/40 font-mono">
                      {activeTabData.browserUrl}
                    </div>
                  </div>
                </div>

                {/* Screenshot with play overlay */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative group cursor-pointer"
                    onClick={() => setVideoModalOpen(true)}
                  >
                    <img
                      src={activeTabData.screenshot}
                      alt={activeTabData.alt}
                      className="w-full"
                      loading="lazy"
                    />
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors duration-300">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-white/20">
                        <Play className="w-7 h-7 text-white ml-1" />
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <VideoModal open={videoModalOpen} onClose={() => setVideoModalOpen(false)} />
    </section>
  );
}
