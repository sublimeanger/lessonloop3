import { motion } from "framer-motion";
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
    <section id="scheduling" className="py-24 lg:py-32 bg-muted/30">
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
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-teal uppercase tracking-wider">
                Scheduling
              </span>
            </div>

            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-6">
              Your calendar,
              <br />
              <span className="text-muted-foreground">supercharged.</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-10">
              Stop juggling spreadsheets and paper diaries. Our calendar is built 
              specifically for music teachers, with every feature you need to manage 
              a busy teaching schedule.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
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
          </motion.div>

          {/* Right: Real Screenshot */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
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
              className="absolute -bottom-6 -left-6 z-10"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1 }}
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
        </div>
      </div>
    </section>
  );
}