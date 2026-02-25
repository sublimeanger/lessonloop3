import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Calendar, 
  Repeat, 
  AlertTriangle, 
  MapPin, 
  Clock,
  CalendarX,
  ArrowRight
} from "lucide-react";
import { calendarReal } from "@/assets/marketing";
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
    <section id="scheduling" className="py-24 lg:py-36 bg-background overflow-hidden relative">
      {/* Subtle accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-teal/30 to-transparent" />
      
      <div className="container mx-auto px-5 sm:px-6 lg:px-8">
        {/* Two-column: text left, screenshot right */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left column - narrow text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-5"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/10 text-teal text-sm font-semibold mb-6">
              <Calendar className="w-4 h-4" />
              Scheduling
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-5 leading-[1.1]">
              Your calendar,
              <br />
              <span className="bg-gradient-to-r from-teal to-teal-light bg-clip-text text-transparent">supercharged.</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
              Stop juggling spreadsheets and paper diaries. LessonLoop's music lesson 
              scheduling software is built specifically for music teachers.
            </p>

            {/* Stacked feature list */}
            <div className="space-y-4 mb-10">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06 }}
                  className="flex items-start gap-3 group"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center group-hover:bg-teal/20 transition-colors mt-0.5">
                    <feature.icon className="w-4 h-4 text-teal" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <Link to="/features/scheduling" className="inline-flex items-center gap-2 text-sm font-semibold text-teal hover:gap-3 transition-all group">
              Explore scheduling features 
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>

          {/* Right column - screenshot */}
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.97 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-7 relative"
          >
            <BrowserFrameLight url="app.lessonloop.net/calendar">
              <img 
                src={calendarReal} 
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
              <div className="bg-card border border-warning/50 rounded-xl p-4 shadow-xl shadow-warning/5">
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

            {/* Floating success badge */}
            <motion.div
              className="absolute -top-4 right-8 z-10 hidden sm:block"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1 }}
            >
              <motion.div
                className="bg-success/10 border border-success/30 text-success rounded-full px-4 py-2 shadow-lg text-xs font-semibold flex items-center gap-1.5"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                No conflicts found
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
