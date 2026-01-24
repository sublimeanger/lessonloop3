import { motion } from "framer-motion";
import { 
  Users, 
  Calendar, 
  CreditCard, 
  Music, 
  MessageSquare,
  FileText,
  Bell,
  Smartphone
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Calendar,
    title: "Schedule Access",
    description: "Parents see upcoming lessons, teacher details, and location info.",
  },
  {
    icon: CreditCard,
    title: "Online Payments",
    description: "Pay invoices securely with card. View payment history anytime.",
  },
  {
    icon: Music,
    title: "Practice Logging",
    description: "Log practice sessions. Track streaks and earn achievements.",
  },
  {
    icon: MessageSquare,
    title: "Messaging",
    description: "Request schedule changes. Get updates from teachers.",
  },
  {
    icon: FileText,
    title: "Resource Access",
    description: "Download shared sheet music and learning materials.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Lesson reminders, payment due alerts, and practice nudges.",
  },
];

export function PortalDeepDive() {
  return (
    <section id="portal" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-teal uppercase tracking-wider">
                Parent Portal
              </span>
            </div>

            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-6">
              Professional experience
              <br />
              <span className="text-muted-foreground">for families.</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-10">
              Give parents a beautiful, branded portal where they can view schedules, 
              pay invoices, track practice, and communicate with teachers. 
              No more chasing payments or answering "what time is the lesson?"
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex gap-3"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-teal" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Testimonial */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="bg-card border border-border rounded-xl p-6"
            >
              <p className="text-muted-foreground italic mb-4">
                "Parents love being able to pay online and track their child's practice. 
                I've had zero payment chasing since we started using the portal."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-teal">SC</span>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Sarah C.</p>
                  <p className="text-xs text-muted-foreground">Piano Teacher, London</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative flex justify-center"
          >
            {/* Phone frame */}
            <div className="relative w-[280px] sm:w-[320px]">
              <div className="relative bg-foreground rounded-[3rem] p-3 shadow-2xl">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-foreground rounded-b-2xl z-10" />
                
                {/* Screen */}
                <div className="relative bg-background rounded-[2.5rem] overflow-hidden">
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-6 py-3 bg-muted/50">
                    <span className="text-xs text-muted-foreground">9:41</span>
                    <div className="flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>

                  {/* App content */}
                  <div className="p-4 pb-8 min-h-[500px]">
                    {/* Header */}
                    <div className="mb-6">
                      <p className="text-xs text-muted-foreground mb-1">Welcome back</p>
                      <h3 className="text-lg font-bold text-foreground">Emma's Portal</h3>
                    </div>

                    {/* Next lesson card */}
                    <motion.div
                      className="bg-teal/10 border border-teal/30 rounded-xl p-4 mb-4"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5 }}
                    >
                      <p className="text-xs text-teal font-medium mb-2">Next Lesson</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground text-sm">Piano with Ms. Johnson</p>
                          <p className="text-xs text-muted-foreground">Tomorrow, 3:00 PM</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-teal/20 flex items-center justify-center">
                          <Music className="w-5 h-5 text-teal" />
                        </div>
                      </div>
                    </motion.div>

                    {/* Practice streak */}
                    <motion.div
                      className="bg-coral/10 border border-coral/30 rounded-xl p-4 mb-4"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.6 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-coral font-medium">Practice Streak</p>
                        <span className="text-xl">🔥</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">7 days</p>
                      <p className="text-xs text-muted-foreground">Keep it up!</p>
                    </motion.div>

                    {/* Outstanding invoice */}
                    <motion.div
                      className="bg-card border border-border rounded-xl p-4 mb-4"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.7 }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Invoice #247</p>
                          <p className="font-semibold text-foreground">£180.00</p>
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
                          Pay Now
                        </div>
                      </div>
                    </motion.div>

                    {/* Quick actions */}
                    <motion.div
                      className="grid grid-cols-4 gap-2"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.8 }}
                    >
                      {[
                        { icon: Calendar, label: "Schedule" },
                        { icon: Music, label: "Practice" },
                        { icon: FileText, label: "Invoices" },
                        { icon: MessageSquare, label: "Message" },
                      ].map((action) => (
                        <div key={action.label} className="flex flex-col items-center gap-1">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <action.icon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{action.label}</span>
                        </div>
                      ))}
                    </motion.div>
                  </div>

                  {/* Home indicator */}
                  <div className="flex justify-center pb-2">
                    <div className="w-32 h-1 rounded-full bg-muted-foreground/30" />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating elements */}
            <motion.div
              className="absolute -top-4 -left-4 z-10 hidden sm:block"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1 }}
            >
              <motion.div
                className="bg-card border border-border rounded-xl p-3 shadow-lg"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Payment received</p>
                    <p className="text-[10px] text-muted-foreground">Just now</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              className="absolute -bottom-4 -right-4 z-10 hidden sm:block"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.2 }}
            >
              <motion.div
                className="bg-card border border-border rounded-xl p-3 shadow-lg"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-coral/20 flex items-center justify-center">
                    <Music className="w-4 h-4 text-coral" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Practice logged!</p>
                    <p className="text-[10px] text-muted-foreground">30 minutes</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
