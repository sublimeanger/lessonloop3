import { motion } from "framer-motion";
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
                Student Management
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

            {/* Why we built this */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="bg-card border border-border rounded-xl p-6"
            >
              <p className="text-sm font-medium text-teal mb-2">Why we built this</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Half of teaching was answering "what time is the lesson?" texts and chasing 
                late payments. The parent portal was built to give families everything they 
                need — schedules, invoices, practice logs — so teachers can focus on teaching.
              </p>
            </motion.div>
          </motion.div>

          {/* Right: Real Screenshot */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative flex justify-center"
          >
            <BrowserFrameLight url="app.lessonloop.net/students">
              <img 
                src={parentPortal} 
                alt="Student list with search, active badges, and avatar initials" 
                className="w-full" 
                loading="lazy" 
              />
            </BrowserFrameLight>

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