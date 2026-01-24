import { motion } from "framer-motion";
import { 
  Calendar, 
  Repeat, 
  AlertTriangle, 
  MapPin, 
  Clock,
  Check,
  CalendarX
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const demoLessons = [
  { time: "09:00", duration: 60, student: "Emma S.", color: "teal", teacher: "Ms. Johnson" },
  { time: "10:00", duration: 30, student: "Oliver T.", color: "coral", teacher: "Ms. Johnson" },
  { time: "11:00", duration: 45, student: "Sophie M.", color: "primary", teacher: "Mr. Davis" },
  { time: "14:00", duration: 60, student: "James W.", color: "teal", teacher: "Ms. Johnson" },
  { time: "15:30", duration: 30, student: "Lily P.", color: "coral", teacher: "Mr. Davis" },
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

          {/* Right: Interactive Demo */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Browser frame */}
            <div className="relative bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 bg-background rounded-md text-xs text-muted-foreground">
                    lessonloop.app/calendar
                  </div>
                </div>
              </div>

              {/* Calendar mockup */}
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Week of January 20</h3>
                    <p className="text-xs text-muted-foreground">5 lessons scheduled</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
                      + New Lesson
                    </div>
                  </div>
                </div>

                {/* Time grid */}
                <div className="relative bg-muted/30 rounded-xl p-3 min-h-[300px]">
                  {/* Time labels */}
                  <div className="absolute left-0 top-3 bottom-3 w-12 flex flex-col justify-between text-xs text-muted-foreground">
                    <span>9:00</span>
                    <span>12:00</span>
                    <span>15:00</span>
                    <span>18:00</span>
                  </div>

                  {/* Lessons */}
                  <div className="ml-14 space-y-2">
                    {demoLessons.map((lesson, index) => (
                      <motion.div
                        key={lesson.student}
                        initial={{ opacity: 0, scale: 0.9, x: -10 }}
                        whileInView={{ opacity: 1, scale: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 + index * 0.1 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-shadow hover:shadow-md",
                          lesson.color === "teal" && "bg-teal/10 border-teal/30",
                          lesson.color === "coral" && "bg-coral/10 border-coral/30",
                          lesson.color === "primary" && "bg-primary/10 border-primary/30"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm text-foreground">{lesson.student}</p>
                            <p className="text-xs text-muted-foreground">
                              {lesson.time} · {lesson.duration}min · {lesson.teacher}
                            </p>
                          </div>
                          <Check className="w-4 h-4 text-success" />
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Drag indicator */}
                  <motion.div
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 1.2 }}
                  >
                    <motion.div
                      className="flex items-center gap-2 px-3 py-2 bg-card border border-dashed border-primary rounded-lg text-xs text-primary"
                      animate={{ y: [0, -20, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <span>Drag to reschedule</span>
                    </motion.div>
                  </motion.div>
                </div>
              </div>
            </div>

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
