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
} from "lucide-react";
import { parentPortal } from "@/assets/marketing";
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
    <section id="portal" className="py-24 lg:py-32 bg-muted/30 relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-teal/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Offset asymmetric layout: screenshot takes 60%, content overlaps */}
        <div className="lg:flex lg:items-center lg:gap-0">
          {/* Screenshot — wide, pushed left */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lg:w-[55%] lg:-mr-12 relative z-0"
          >
            <BrowserFrameLight url="app.lessonloop.net/portal">
              <img 
                src={parentPortal} 
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
          </motion.div>

          {/* Content — overlapping card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:w-[50%] relative z-10 -mt-8 lg:mt-0"
          >
            <div className="bg-card border border-border rounded-2xl p-8 lg:p-10 shadow-xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/10 text-teal text-sm font-semibold mb-6">
                <Users className="w-4 h-4" />
                Parent Portal
              </div>

              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                Professional experience
                <br />
                <span className="text-muted-foreground">for families.</span>
              </h2>

              <p className="text-muted-foreground mb-8">
                Give parents a beautiful, branded parent portal where they can view lesson schedules, 
                make online payments, track practice with streak gamification, read lesson notes, 
                and access shared resources. No more chasing.
              </p>

              {/* Numbered feature list — vertical, not grid */}
              <div className="space-y-4 mb-8">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, x: -15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + index * 0.08 }}
                    className="flex items-center gap-4"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center text-xs font-bold text-teal">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-foreground text-sm">{feature.title}</span>
                      <span className="text-muted-foreground text-sm"> — {feature.description}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <Link to="/features/parent-portal" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
                Explore the parent portal <span>→</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
