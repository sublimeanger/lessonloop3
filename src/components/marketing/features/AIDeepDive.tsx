import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Sparkles, 
  Zap, 
  FileText,
  Search,
  Shield,
  Check,
  Send
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

const features = [
  {
    icon: Search,
    title: "Natural Language Queries",
    description: "Ask questions in plain English. Get instant answers about your data.",
  },
  {
    icon: Zap,
    title: "Smart Actions",
    description: "Propose invoice runs, send reminders, reschedule lessons—with one command.",
  },
  {
    icon: FileText,
    title: "Message Drafting",
    description: "Generate professional emails to parents with context-aware suggestions.",
  },
  {
    icon: Shield,
    title: "Confirm to Execute",
    description: "Every action requires your approval. You're always in control.",
  },
];

const chatMessages = [
  { role: "user", content: "How much am I owed this month?" },
  { role: "assistant", content: "You have **£1,240** outstanding from 8 invoices. 3 are overdue. Would you like me to send payment reminders?" },
  { role: "user", content: "Yes, send reminders to overdue" },
  { role: "assistant", content: "I'll prepare reminders for 3 parents with overdue invoices:", action: true },
];

const actionProposal = {
  title: "Send Payment Reminders",
  items: [
    { name: "Sarah Mitchell", amount: "£180", days: "5 days overdue" },
    { name: "James Thompson", amount: "£120", days: "3 days overdue" },
    { name: "Emma Watson", amount: "£90", days: "2 days overdue" },
  ],
};

export function AIDeepDive() {
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [showAction, setShowAction] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  // Only start animation sequence when section comes into view
  useEffect(() => {
    if (isInView && !hasStarted) {
      setHasStarted(true);
    }
  }, [isInView, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    if (visibleMessages >= chatMessages.length) return;

    const timer = setTimeout(() => {
      if (chatMessages[visibleMessages].role === "assistant") {
        setIsTyping(true);
        const typingTimer = setTimeout(() => {
          setIsTyping(false);
          setVisibleMessages(v => v + 1);
          if (chatMessages[visibleMessages].action) {
            setTimeout(() => setShowAction(true), 500);
          }
        }, 1000);
        return () => clearTimeout(typingTimer);
      } else {
        setVisibleMessages(v => v + 1);
      }
    }, visibleMessages === 0 ? 1000 : 2000);
    return () => clearTimeout(timer);
  }, [visibleMessages, hasStarted]);

  return (
    <section id="ai" className="py-24 lg:py-32 bg-background" ref={sectionRef}>
      <div className="container mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Chat Demo */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative order-2 lg:order-1"
          >
            {/* Chat window */}
            <div className="relative bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">LoopAssist</p>
                  <p className="text-xs text-muted-foreground">AI-powered assistant</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs text-muted-foreground">Online</span>
                </div>
              </div>

              {/* Messages */}
              <div className="p-4 min-h-[350px] space-y-4">
                {chatMessages.slice(0, visibleMessages).map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}>
                      {message.content.split("**").map((part, i) =>
                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 rounded-full bg-muted-foreground/50"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Action proposal card */}
                {showAction && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-coral/5 border border-coral/30 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-coral" />
                      <span className="font-medium text-sm text-foreground">{actionProposal.title}</span>
                    </div>
                    <div className="space-y-2 mb-4">
                      {actionProposal.items.map((item, i) => (
                        <motion.div
                          key={item.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center justify-between py-2 border-b border-border last:border-0"
                        >
                          <div>
                            <p className="text-sm text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.days}</p>
                          </div>
                          <span className="font-medium text-foreground">{item.amount}</span>
                        </motion.div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-coral text-white text-sm font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Check className="w-4 h-4" />
                        Confirm & Send
                      </motion.button>
                      <button className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-border p-3">
                <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2.5">
                  <input
                    type="text"
                    placeholder="Ask LoopAssist anything..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    disabled
                  />
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <Send className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
              </div>
            </div>

            {/* Security badge */}
            <motion.div
              className="absolute -bottom-4 -left-4 z-10"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.5 }}
            >
              <div className="bg-card border border-border rounded-xl p-3 shadow-lg flex items-center gap-2">
                <Shield className="w-4 h-4 text-success" />
                <span className="text-xs text-muted-foreground">Actions require confirmation</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="order-1 lg:order-2"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-coral uppercase tracking-wider">
                AI Assistant
              </span>
            </div>

            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-6">
              Meet LoopAssist.
              <br />
              <span className="text-muted-foreground">Your AI co-pilot.</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-10">
              Ask questions about your music school in natural language. Get instant answers, 
              generate reports, draft messages, and execute actions — all from a simple chat interface. 
              LoopAssist is the AI assistant built into every LessonLoop plan, helping you work smarter.
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
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-coral/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-coral" />
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

            {/* Example queries */}
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "What's my revenue this month?",
                  "Who cancelled lessons this week?",
                  "Draft a reminder for overdue invoices",
                ].map((query) => (
                  <span
                    key={query}
                    className="px-3 py-1.5 bg-card rounded-full text-xs text-muted-foreground border border-border"
                  >
                    "{query}"
                  </span>
                ))}
              </div>
            </div>

            <Link to="/features/loopassist" className="inline-flex items-center gap-1.5 mt-8 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
              Explore LoopAssist <span>→</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
