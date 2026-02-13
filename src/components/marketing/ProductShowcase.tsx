import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Receipt, Users, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { calendarWeek, invoicesList, parentPortal, loopassistChat } from "@/assets/marketing";

const tabs = [
  { 
    id: "calendar", 
    label: "Calendar", 
    icon: Calendar,
    description: "Drag-and-drop scheduling with conflict detection",
    features: ["Week & day views", "Recurring lessons", "Room booking", "Closure dates"],
    screenshot: calendarWeek,
    alt: "Weekly calendar view with colour-coded lessons",
    url: "app.lessonloop.net/calendar",
  },
  { 
    id: "invoices", 
    label: "Invoicing", 
    icon: Receipt,
    description: "Automated billing with online payments",
    features: ["Bulk generation", "Auto reminders", "Stripe payments", "VAT support"],
    screenshot: invoicesList,
    alt: "Invoice management with status tracking and bulk actions",
    url: "app.lessonloop.net/invoices",
  },
  { 
    id: "students", 
    label: "Students", 
    icon: Users,
    description: "Complete student and family management",
    features: ["Student profiles", "Guardian linking", "Lesson history", "Practice tracking"],
    screenshot: parentPortal,
    alt: "Student list with search, filters, and active badges",
    url: "app.lessonloop.net/students",
  },
  { 
    id: "ai", 
    label: "AI Assistant", 
    icon: Sparkles,
    description: "Your intelligent teaching assistant",
    features: ["Natural queries", "Smart actions", "Draft messages", "Insights"],
    screenshot: loopassistChat,
    alt: "LoopAssist AI assistant interface",
    url: "app.lessonloop.net/loopassist",
  },
];

export function ProductShowcase() {
  const [activeTab, setActiveTab] = useState("calendar");
  const activeTabData = tabs.find((t) => t.id === activeTab)!;

  return (
    <section className="py-24 lg:py-32 bg-ink relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-teal/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-teal-light text-sm font-semibold mb-6">
            Product Tour
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
            See it in action
          </h2>
          <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto">
            Explore the key features that make LessonLoop purpose-built for UK music educators.
          </p>
        </motion.div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all",
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
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-white/10 rounded-lg px-4 py-1 text-xs text-white/40 font-mono">
                      {activeTabData.url}
                    </div>
                  </div>
                </div>

                {/* Real Screenshot */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <img
                      src={activeTabData.screenshot}
                      alt={activeTabData.alt}
                      className="w-full"
                      loading="lazy"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}