import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Receipt, Users, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { 
    id: "calendar", 
    label: "Calendar", 
    icon: Calendar,
    description: "Drag-and-drop scheduling with conflict detection",
    features: ["Week & day views", "Recurring lessons", "Room booking", "Closure dates"]
  },
  { 
    id: "invoices", 
    label: "Invoicing", 
    icon: Receipt,
    description: "Automated billing with online payments",
    features: ["Bulk generation", "Auto reminders", "Stripe payments", "VAT support"]
  },
  { 
    id: "portal", 
    label: "Parent Portal", 
    icon: Users,
    description: "Self-service portal for parents and guardians",
    features: ["View schedule", "Pay online", "Track practice", "Message teacher"]
  },
  { 
    id: "ai", 
    label: "AI Assistant", 
    icon: Sparkles,
    description: "Your intelligent teaching assistant",
    features: ["Natural queries", "Smart actions", "Draft messages", "Insights"]
  },
];

// Get current month dynamically for evergreen content
const getCurrentMonthYear = () => {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

// Mock UI components for each tab
function CalendarMockup() {
  const times = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const lessons = [
    { day: 0, start: 0, duration: 1, student: "Emma W.", color: "bg-teal" },
    { day: 1, start: 2, duration: 1, student: "Oliver J.", color: "bg-coral" },
    { day: 2, start: 1, duration: 1, student: "Sophie M.", color: "bg-violet-500" },
    { day: 3, start: 3, duration: 2, student: "James C.", color: "bg-teal" },
    { day: 4, start: 0, duration: 1, student: "Lily P.", color: "bg-amber-500" },
    { day: 0, start: 4, duration: 1, student: "Noah B.", color: "bg-coral" },
    { day: 2, start: 5, duration: 1, student: "Mia K.", color: "bg-emerald-500" },
  ];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-foreground">{getCurrentMonthYear()}</div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">+ New</div>
          <div className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground">Week</div>
        </div>
      </div>
      
      <div className="grid grid-cols-6 gap-1">
        {/* Time column */}
        <div className="space-y-1">
          <div className="h-8" />
          {times.map((time) => (
            <div key={time} className="h-12 text-xs text-muted-foreground font-mono flex items-start pt-1">{time}</div>
          ))}
        </div>
        
        {/* Day columns */}
        {days.map((day, dayIdx) => (
          <div key={day} className="space-y-1">
            <div className="h-8 text-xs font-medium text-center text-muted-foreground flex flex-col items-center">
              <span>{day}</span>
              <span className="text-foreground">{20 + dayIdx}</span>
            </div>
            <div className="relative">
              {times.map((_, timeIdx) => (
                <div key={timeIdx} className="h-12 border-t border-dashed border-border" />
              ))}
              {/* Lessons */}
              {lessons
                .filter((l) => l.day === dayIdx)
                .map((lesson, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className={cn(
                      "absolute left-0 right-0 mx-0.5 rounded-lg p-1.5 text-white text-xs font-medium overflow-hidden",
                      lesson.color
                    )}
                    style={{
                      top: `${lesson.start * 48 + 4}px`,
                      height: `${lesson.duration * 48 - 8}px`,
                    }}
                  >
                    {lesson.student}
                  </motion.div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoicesMockup() {
  const invoices = [
    { id: "#247", payer: "Watson Family", amount: "£135", status: "paid", date: "Jan 15" },
    { id: "#248", payer: "Chen Family", amount: "£180", status: "pending", date: "Jan 18" },
    { id: "#249", payer: "Thompson Family", amount: "£90", status: "overdue", date: "Jan 10" },
    { id: "#250", payer: "Brown Family", amount: "£120", status: "draft", date: "Jan 20" },
  ];

  const statusStyles = {
    paid: "bg-emerald-500/10 text-emerald-600",
    pending: "bg-amber-500/10 text-amber-600",
    overdue: "bg-red-500/10 text-red-600",
    draft: "bg-muted text-muted-foreground",
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-foreground">Invoices</div>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">+ Create</div>
          <div className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground">Billing Run</div>
        </div>
      </div>
      
      <div className="space-y-2">
        {invoices.map((inv, i) => (
          <motion.div
            key={inv.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-xs font-mono text-muted-foreground">{inv.id}</div>
              <div>
                <div className="text-sm font-medium text-foreground">{inv.payer}</div>
                <div className="text-xs text-muted-foreground">{inv.date}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", statusStyles[inv.status as keyof typeof statusStyles])}>
                {inv.status}
              </span>
              <span className="text-sm font-semibold font-mono">{inv.amount}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PortalMockup() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center text-white font-bold text-sm">
          W
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">Watson Family</div>
          <div className="text-xs text-muted-foreground">2 children enrolled</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "Next Lesson", value: "Tomorrow, 4pm", sub: "Piano - Emma" },
          { label: "Outstanding", value: "£0.00", sub: "All paid" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="p-3 rounded-xl bg-muted/50 border border-border"
          >
            <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
            <div className="text-lg font-bold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.sub}</div>
          </motion.div>
        ))}
      </div>
      
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upcoming</div>
        {[
          { child: "Emma", day: "Mon 27th", time: "4:00pm", type: "Piano" },
          { child: "Emma", day: "Wed 29th", time: "4:00pm", type: "Piano" },
          { child: "Oliver", day: "Tue 28th", time: "5:00pm", type: "Guitar" },
        ].map((lesson, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="flex items-center justify-between p-3 rounded-xl border border-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full bg-teal" />
              <div>
                <div className="text-sm font-medium text-foreground">{lesson.child} - {lesson.type}</div>
                <div className="text-xs text-muted-foreground">{lesson.day} at {lesson.time}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AIMockup() {
  const conversation = [
    { role: "user", text: "Which students haven't paid for January?" },
    { role: "ai", text: "I found 3 students with outstanding January invoices:\n\n• Thompson Family - £90 (15 days overdue)\n• Chen Family - £180 (pending)\n• Brown Family - £120 (draft)\n\nWould you like me to send payment reminders?" },
    { role: "user", text: "Yes, send reminders to Thompson and Chen" },
    { role: "ai", text: "✓ Sent payment reminder to Thompson Family\n✓ Sent payment reminder to Chen Family\n\nBoth families will receive an email with a payment link." },
  ];

  return (
    <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
      {conversation.map((msg, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + i * 0.2 }}
          className={cn(
            "p-3 rounded-2xl text-sm whitespace-pre-line",
            msg.role === "user"
              ? "bg-primary text-primary-foreground ml-8 rounded-br-sm"
              : "bg-muted text-foreground mr-8 rounded-bl-sm"
          )}
        >
          {msg.text}
        </motion.div>
      ))}
    </div>
  );
}

const mockups: Record<string, () => JSX.Element> = {
  calendar: CalendarMockup,
  invoices: InvoicesMockup,
  portal: PortalMockup,
  ai: AIMockup,
};

export function ProductShowcase() {
  const [activeTab, setActiveTab] = useState("calendar");
  const activeTabData = tabs.find((t) => t.id === activeTab)!;
  const MockupComponent = mockups[activeTab];

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

          {/* Mockup Side */}
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
                      app.lessonloop.net/{activeTab}
                    </div>
                  </div>
                </div>

                {/* Mockup Content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="bg-card min-h-[400px]"
                  >
                    <MockupComponent />
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
