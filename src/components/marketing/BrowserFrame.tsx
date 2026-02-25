import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BrowserFrameProps {
  children: React.ReactNode;
  url?: string;
  className?: string;
  animate?: boolean;
}

export function BrowserFrame({ 
  children, 
  url = "app.lessonloop.net", 
  className,
  animate = true 
}: BrowserFrameProps) {
  const Wrapper = animate ? motion.div : "div";
  const wrapperProps = animate ? {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/40",
        className
      )}
    >
      {/* Browser Top Bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive/80" />
          <div className="w-3 h-3 rounded-full bg-warning/80" />
          <div className="w-3 h-3 rounded-full bg-success/80" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-white/10 rounded-lg px-4 py-1 text-xs text-white/40 font-mono">
            {url}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </Wrapper>
  );
}

// Light version for use on light backgrounds
export function BrowserFrameLight({ 
  children, 
  url = "app.lessonloop.net", 
  className,
  animate = true 
}: BrowserFrameProps) {
  const Wrapper = animate ? motion.div : "div";
  const wrapperProps = animate ? {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
  } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "relative rounded-2xl overflow-hidden border border-border bg-card shadow-2xl shadow-black/10",
        className
      )}
    >
      {/* Browser Top Bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive" />
          <div className="w-3 h-3 rounded-full bg-warning" />
          <div className="w-3 h-3 rounded-full bg-success" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-background rounded-lg px-4 py-1 text-xs text-muted-foreground font-mono border border-border">
            {url}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </Wrapper>
  );
}

// Device frame for mobile mockups
interface DeviceFrameProps {
  children: React.ReactNode;
  device?: "iphone" | "ipad";
  className?: string;
}

export function DeviceFrame({ 
  children, 
  device = "iphone",
  className 
}: DeviceFrameProps) {
  const isPhone = device === "iphone";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={cn(
        "relative bg-ink rounded-[3rem] p-3 shadow-2xl shadow-black/40",
        isPhone ? "w-[280px]" : "w-[500px]",
        className
      )}
    >
      {/* Notch (iPhone only) */}
      {isPhone && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-7 bg-ink rounded-b-2xl z-10" />
      )}
      
      {/* Screen */}
      <div className={cn(
        "relative overflow-hidden bg-background",
        isPhone ? "rounded-[2.5rem]" : "rounded-[1.5rem]"
      )}>
        {children}
      </div>
      
      {/* Home indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/20 rounded-full" />
    </motion.div>
  );
}
