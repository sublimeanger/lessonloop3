import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Users, 
  Calendar, 
  CreditCard, 
  Music, 
  MessageSquare,
  FileText,
  Bell,
  ArrowRight
} from "lucide-react";
import { messagesReal } from "@/assets/marketing";
import { BrowserFrameLight } from "@/components/marketing/BrowserFrame";

const features = [
  { icon: Calendar, title: "Schedule Access", description: "Parents see upcoming lessons, teacher details, and location info." },
  { icon: CreditCard, title: "Online Payments", description: "Pay invoices securely with card. View payment history anytime." },
  { icon: Music, title: "Practice Logging", description: "Log practice sessions. Track streaks and earn achievements." },
  { icon: MessageSquare, title: "Messaging", description: "Request schedule changes. Get updates from teachers." },
  { icon: FileText, title: "Resource Access", description: "Download shared sheet music and learning materials." },
  { icon: Bell, title: "Notifications", description: "Lesson reminders, payment due alerts, and practice nudges." },
];

export function PortalDeepDive() {
  return (
    <section id="portal" className="py-24 lg:py-36 bg-background relative overflow-hidden">
      {/* Accent line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />
      
      <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left: Screenshot — wider */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-7 relative"
          >
            <BrowserFrameLight url="app.lessonloop.net/portal">
              <img 
                src={messagesReal} 
                alt="Student list with search, active badges, and avatar initials" 
                className="w-full" 
                loading="lazy" 
              />
            </BrowserFrameLight>

            {/* Floating cards */}
            <motion.div
              className="absolute -top-4 right-8 z-10 hidden sm:block"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 }}
            >
              <motion.div
                className="bg-card border border-border rounded-xl p-3 shadow-xl"
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

            {/* Practice streak badge */}
            <motion.div
              className="absolute -bottom-4 right-12 z-10 hidden sm:block"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.1 }}
            >
              <motion.div
                className="bg-card border border-border rounded-xl p-3 shadow-xl"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-coral/20 flex items-center justify-center">
                    <Music className="w-4 h-4 text-coral" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">7-day streak! 🔥</p>
                    <p className="text-[10px] text-muted-foreground">Oliver's practice</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-5"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/10 text-teal text-sm font-semibold mb-6">
              <Users className="w-4 h-4" />
              Parent Portal
            </div>

            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-5 leading-[1.1]">
              Professional
              <br />
              <span className="text-muted-foreground">for families.</span>
            </h2>

            <p className="text-muted-foreground mb-10 leading-relaxed">
              Give parents a beautiful, branded parent portal where they can view lesson schedules, 
              make online payments, track practice, and access shared resources.
            </p>

            {/* Numbered feature list */}
            <div className="space-y-3 mb-10">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + index * 0.06 }}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center text-xs font-bold text-teal">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground text-sm">{feature.title}</span>
                    <span className="text-muted-foreground text-sm"> — {feature.description}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <Link to="/features/parent-portal" className="inline-flex items-center gap-2 text-sm font-semibold text-teal hover:gap-3 transition-all group">
              Explore the parent portal
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
