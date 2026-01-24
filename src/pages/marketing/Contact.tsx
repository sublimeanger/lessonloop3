import { motion } from "framer-motion";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Mail, Phone, MapPin, MessageSquare, Clock, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const contactMethods = [
  {
    icon: Mail,
    title: "Email Us",
    description: "Get a response within 24 hours",
    value: "hello@lessonloop.com",
    action: "mailto:hello@lessonloop.com",
  },
  {
    icon: MessageSquare,
    title: "Live Chat",
    description: "Available Mon-Fri, 9am-5pm",
    value: "Start a conversation",
    action: "#",
  },
  {
    icon: Phone,
    title: "Call Us",
    description: "Speak to our support team",
    value: "+44 20 1234 5678",
    action: "tel:+442012345678",
  },
];

export default function Contact() {
  return (
    <MarketingLayout>
      {/* Header Section */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero-light" />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-teal/10 rounded-full blur-[120px]" />
        
        <div className="container mx-auto px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
              Contact
            </span>
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Get in touch
            </h1>
            <p className="text-xl text-muted-foreground">
              Have a question or need help? We're here for you.
              Our team typically responds within 24 hours.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {contactMethods.map((method, index) => (
              <motion.a
                key={method.title}
                href={method.action}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300 text-center group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center mx-auto mb-4">
                  <method.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{method.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{method.description}</p>
                <span className="text-primary font-medium group-hover:underline">{method.value}</span>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 max-w-6xl mx-auto">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
                Send us a message
              </h2>
              <p className="text-muted-foreground mb-8">
                Fill out the form below and we'll get back to you as soon as possible.
              </p>

              <form className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Smith"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Subject
                  </label>
                  <select className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                    <option>General Enquiry</option>
                    <option>Sales Question</option>
                    <option>Technical Support</option>
                    <option>Partnership Opportunity</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Message
                  </label>
                  <textarea
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="How can we help you?"
                  />
                </div>

                <Button size="lg" className="w-full font-semibold">
                  Send Message
                </Button>
              </form>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:pl-8"
            >
              <div className="p-8 rounded-3xl bg-ink text-white">
                <h3 className="text-xl font-bold mb-6">Helpful Information</h3>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-teal-light" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Business Hours</h4>
                      <p className="text-sm text-white/60">
                        Monday - Friday: 9:00 AM - 5:00 PM GMT
                        <br />
                        Saturday - Sunday: Closed
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-teal-light" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Office Location</h4>
                      <p className="text-sm text-white/60">
                        123 Music Lane
                        <br />
                        London, EC1A 1BB
                        <br />
                        United Kingdom
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <HelpCircle className="w-5 h-5 text-teal-light" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Need Quick Answers?</h4>
                      <p className="text-sm text-white/60">
                        Check out our{" "}
                        <a href="/docs" className="text-teal-light hover:underline">
                          Help Centre
                        </a>{" "}
                        for FAQs and guides.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
