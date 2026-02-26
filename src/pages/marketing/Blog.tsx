import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Clock, ArrowRight, BookOpen, Sparkles, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import type { BlogPost } from "@/data/blogPosts";

const CATEGORIES = ["All", "Teaching Tips", "Product Updates", "Music Business", "Guides"] as const;

function FeaturedPost({ post }: { post: BlogPost }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
    >
      <Link to={`/blog/${post.slug}`} className="block group">
        <div className="grid lg:grid-cols-2 gap-0 rounded-3xl border border-border/60 bg-card overflow-hidden hover:border-primary/30 hover:shadow-2xl transition-all duration-500">
          <div className="aspect-video lg:aspect-auto lg:min-h-[360px] relative overflow-hidden">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              loading="eager"
              width={640}
              height={360}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-black/5" />
          </div>
          <div className="p-8 lg:p-12 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-5">
              <span className="px-3 py-1 rounded-full bg-[hsl(var(--coral)/0.15)] text-[hsl(var(--coral))] text-xs font-bold uppercase tracking-wider">
                Featured
              </span>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {post.category}
              </span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-4 leading-tight group-hover:text-primary transition-colors">
              {post.title}
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed line-clamp-3">
              {post.excerpt}
            </p>
            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {post.author.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{post.author.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {post.readTime}
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-sm font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Read <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

function PostCard({ post, index }: { post: BlogPost; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.5 }}
      className="group"
    >
      <Link to={`/blog/${post.slug}`} className="block h-full">
        <div className="h-full rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-primary/30 hover:shadow-xl transition-all duration-300 flex flex-col">
          <div className="aspect-[16/10] relative overflow-hidden">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              width={400}
              height={250}
            />
          </div>
          <div className="p-6 flex flex-col flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {post.category}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {post.readTime}
              </span>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
              {post.title}
            </h3>
            <p className="text-muted-foreground text-sm mb-4 line-clamp-2 flex-1">
              {post.excerpt}
            </p>
            <div className="flex items-center justify-between pt-4 border-t border-border/40 mt-auto">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                  {post.author.name.split(" ").map(n => n[0]).join("")}
                </div>
                <span className="text-xs text-muted-foreground">{post.author.name}</span>
              </div>
              {/* Date intentionally hidden — evergreen content */}
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

export default function Blog() {
  usePageMeta(
    "Blog — Tips & Guides for UK Music Educators | LessonLoop",
    "Expert tips, practical guides, and industry insights to help UK music teachers run thriving teaching practices. Scheduling, billing, and growth strategies.",
    {
      canonical: "https://lessonloop.co.uk/blog",
      ogTitle: "Blog — Tips & Guides for UK Music Educators",
      ogDescription: "Expert tips, practical guides, and industry insights for UK music teachers.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/blog",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow",
    }
  );

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    import("@/data/blogPosts").then(mod => {
      setPosts(mod.blogPosts);
      setIsLoading(false);
    });
  }, []);

  const filteredPosts = posts.filter(p => {
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    const matchesSearch = !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featured = filteredPosts[0];
  const remaining = filteredPosts.slice(1);

  return (
    <MarketingLayout>
      {/* ═══ HERO ═══ */}
      <section className="relative pt-28 pb-16 sm:pt-32 lg:pt-40 lg:pb-20 overflow-hidden">
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <motion.div
          className="absolute top-10 -left-40 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)" }}
        />
        <motion.div
          className="absolute bottom-0 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(var(--coral)) 0%, transparent 70%)" }}
        />

        <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6">
              <BookOpen className="w-4 h-4" />
              Blog
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight mb-6">
              Insights for{" "}
              <span className="bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] bg-clip-text text-transparent">
                music educators
              </span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Tips, guides, and best practices to help you run a successful
              music teaching practice in the UK.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══ FILTERS ═══ */}
      <section className="border-y border-border/40 bg-secondary/20 py-5 sticky top-20 z-20 backdrop-blur-xl">
        <div className="container mx-auto px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex flex-wrap gap-2 justify-center">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-card text-muted-foreground hover:bg-muted border border-border/60"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-card"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ POSTS ═══ */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-5 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="space-y-12">
              <div className="grid lg:grid-cols-2 gap-0 rounded-3xl border border-border bg-card overflow-hidden">
                <Skeleton className="aspect-video lg:min-h-[360px]" />
                <div className="p-12 space-y-4">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
                    <Skeleton className="aspect-[16/10] w-full" />
                    <div className="p-6 space-y-3">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredPosts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No posts found</h3>
              <p className="text-muted-foreground mb-6">Try a different search term or category.</p>
              <button
                onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Clear filters
              </button>
            </motion.div>
          ) : (
            <div className="space-y-16">
              {/* Featured */}
              {featured && <FeaturedPost post={featured} />}

              {/* Grid */}
              {remaining.length > 0 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {remaining.map((post, index) => (
                    <PostCard key={post.slug} post={post} index={index} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ═══ CTA STRIP ═══ */}
      <section className="border-t border-border/40 bg-[hsl(var(--ink))] py-16">
        <div className="container mx-auto px-5 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[hsl(var(--teal))] text-xs font-semibold mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              Ready to simplify your teaching life?
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
              Stop juggling spreadsheets.{" "}
              <span className="text-white/50">Start teaching.</span>
            </h2>
            <p className="text-white/50 mb-8 max-w-lg mx-auto">
              LessonLoop handles your{" "}
              <Link to="/features/scheduling" className="text-[hsl(var(--teal))] hover:underline font-medium">music lesson scheduling</Link>,{" "}
              <Link to="/features/billing" className="text-[hsl(var(--teal))] hover:underline font-medium">invoicing and billing</Link>, and{" "}
              <Link to="/features/parent-portal" className="text-[hsl(var(--teal))] hover:underline font-medium">parent portal</Link>{" "}
              — so you can focus on making music.
            </p>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            >
              View plans and pricing <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
