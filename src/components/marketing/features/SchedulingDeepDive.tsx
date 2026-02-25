import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Calendar, 
  Repeat, 
  AlertTriangle, 
  MapPin, 
  Clock,
  CalendarX
} from "lucide-react";
import { calendarWeek } from "@/assets/marketing";
import { BrowserFrameLight } from "@/components/marketing/BrowserFrame";

const features = [
  {
    icon: Calendar,
    title: "Drag & Drop Calendar",
    description: "Intuitive week and month views. Reschedule with a simple drag.",
  },
  {
    icon: Repeat,
    title: "Recurring Lessons",
    description: "Weekly, fortnightly, or custom patterns. Auto-skip holidays.",
  },
  {
    icon: AlertTriangle,
    title: "Conflict Detection",
    description: "Real-time alerts prevent double-bookings for teachers and rooms.",
  },
  {
    icon: MapPin,
    title: "Multi-Location",
    description: "Manage rooms across multiple venues with availability tracking.",
  },
  {
    icon: Clock,
    title: "Flexible Durations",
    description: "30, 45, 60 minutes or custom. Different rates per duration.",
  },
  {
    icon: CalendarX,
    title: "Closure Dates",
    description: "Set school holidays and closures. Lessons auto-skip blocked dates.",
  },
];

export function SchedulingDeepDive() {
  return (
    <section id="scheduling" className="py-24 lg:py-32 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-6 lg:px-8">
        {/* Cinematic top: badge + headline centered */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-12 lg:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/10 text-teal text-sm font-semibold mb-6">
            <Calendar className="w-4 h-4" />
            Scheduling
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
            Your calendar,{" "}
            <span className="text-muted-foreground">supercharged.</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Stop juggling spreadsheets and paper diaries. LessonLoop's music lesson 
            scheduling software is built specifically for music teachers, with drag-and-drop 
            scheduling, conflict detection, and recurring lesson management.
          </p>
        </motion.div>

        {/* Full-width screenshot hero */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative max-w-5xl mx-auto mb-16"
        >
          <BrowserFrameLight url="app.lessonloop.net/calendar">
            <img 
              src={calendarWeek} 
              alt="Weekly calendar view with colour-coded lessons and teacher filters" 
              className="w-full" 
              loading="lazy" 
            />
          </BrowserFrameLight>

          {/* Floating conflict alert */}
          <motion.div
            className="absolute -bottom-6 left-4 lg:left-8 z-10"
            initial={{ opacity: 0, scale: 0.8, x: -20 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
          >
            <div className="bg-card border border-warning/50 rounded-xl p-4 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Conflict detected</p>
                  <p className="text-xs text-muted-foreground">Room 1 already booked at 3pm</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Feature pills — horizontal row, not grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="bg-card border border-border rounded-xl p-4 text-center hover:border-teal/40 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-teal/20 transition-colors">
                <feature.icon className="w-5 h-5 text-teal" />
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <Link to="/features/scheduling" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
            Explore scheduling features <span>→</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
