import { motion } from "framer-motion";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Calendar } from "lucide-react";

const blogPosts = [
  {
    title: "10 Time-Saving Tips for Music Teachers in 2024",
    excerpt: "Discover proven strategies to streamline your admin work and focus more on what you love: teaching music.",
    date: "15 Jan 2024",
    category: "Productivity",
    readTime: "5 min read",
    image: "from-teal to-teal-dark",
  },
  {
    title: "How to Set Your Lesson Rates in the UK",
    excerpt: "A comprehensive guide to pricing your music lessons competitively while maintaining profitability.",
    date: "10 Jan 2024",
    category: "Business",
    readTime: "8 min read",
    image: "from-coral to-coral-dark",
  },
  {
    title: "The Complete Guide to Parent Communication",
    excerpt: "Best practices for keeping parents informed and engaged in their child's musical journey.",
    date: "5 Jan 2024",
    category: "Communication",
    readTime: "6 min read",
    image: "from-ink to-ink-light",
  },
  {
    title: "Managing Multiple Teaching Locations",
    excerpt: "Tips and tools for teachers who work across several venues, from schools to home studios.",
    date: "1 Jan 2024",
    category: "Operations",
    readTime: "7 min read",
    image: "from-teal to-teal-dark",
  },
  {
    title: "GDPR Compliance for Music Teachers",
    excerpt: "What you need to know about data protection and student privacy in your teaching practice.",
    date: "28 Dec 2023",
    category: "Legal",
    readTime: "10 min read",
    image: "from-coral to-coral-dark",
  },
  {
    title: "Building a Sustainable Teaching Practice",
    excerpt: "Long-term strategies for growing your music teaching business without burning out.",
    date: "22 Dec 2023",
    category: "Business",
    readTime: "9 min read",
    image: "from-ink to-ink-light",
  },
];

export default function Blog() {
  return (
    <MarketingLayout>
      {/* Header Section */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero-light" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-coral/10 rounded-full blur-[120px]" />
        
        <div className="container mx-auto px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
              Blog
            </span>
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Insights for
              <br />
              <span className="text-muted-foreground">music educators</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Tips, guides, and best practices to help you run a successful 
              music teaching practice.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post, index) => (
              <motion.article
                key={post.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="group"
              >
              <div className="block cursor-default">
                  <div className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-xl transition-all duration-300">
                    {/* Image Placeholder */}
                    <div className={`aspect-video bg-gradient-to-br ${post.image} relative`}>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Calendar className="w-8 h-8 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {post.category}
                        </span>
                        <span className="text-xs text-muted-foreground">{post.readTime}</span>
                      </div>

                      <h3 className="text-lg font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {post.excerpt}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{post.date}</span>
                        <span className="px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                          Coming soon
                        </span>
                      </div>
                      </div>
                    </div>
                  </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
