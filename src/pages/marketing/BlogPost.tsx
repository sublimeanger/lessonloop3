import { useEffect, useState, useCallback, useRef } from "react";
import { logger } from "@/lib/logger";
import { useParams, Link, useNavigate } from "react-router-dom";
import { sanitizeHtml } from "@/lib/sanitize";
import { motion, useScroll, useSpring } from "framer-motion";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, User, Share2, Twitter, Linkedin, Copy, Check, List, ChevronRight, Sparkles } from "lucide-react";
import type { BlogPost as BlogPostType } from "@/data/blogPosts";
import { usePageMeta } from "@/hooks/usePageMeta";

/* ─── Reading Progress Bar ─── */
function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[3px] z-50 origin-left bg-gradient-to-r from-[hsl(var(--teal))] via-[hsl(var(--primary))] to-[hsl(var(--coral))]"
      style={{ scaleX }}
    />
  );
}

/* ─── Table of Contents ─── */
function TableOfContents({ headings, activeId }: { headings: { id: string; text: string }[]; activeId: string }) {
  if (headings.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6"
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <List className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">Contents</h3>
      </div>
      <nav className="space-y-1">
        {headings.map((heading, i) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={`group flex items-start gap-2.5 py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
              activeId === heading.id
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <span className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold mt-0.5 transition-colors ${
              activeId === heading.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
            }`}>
              {i + 1}
            </span>
            <span className="leading-snug">{heading.text}</span>
          </a>
        ))}
      </nav>
    </motion.div>
  );
}

/* ─── Share Buttons ─── */
function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error("Failed to copy link:", err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Share</span>
      <button
        onClick={handleCopy}
        className="w-9 h-9 rounded-lg border border-border/60 bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
        aria-label="Copy link"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-9 h-9 rounded-lg border border-border/60 bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
        aria-label="Share on Twitter"
      >
        <Twitter className="w-4 h-4" />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-9 h-9 rounded-lg border border-border/60 bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="w-4 h-4" />
      </a>
    </div>
  );
}

/* ─── Sidebar CTA ─── */
function SidebarCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-primary/10 -translate-y-1/2 translate-x-1/2" />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold mb-3">
          <Sparkles className="w-3 h-3" />
          Free for 30 days
        </div>
        <h3 className="font-bold text-foreground mb-2 leading-snug">Ready to simplify your teaching?</h3>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          Join UK music teachers saving hours every week with LessonLoop.
        </p>
        <Button asChild className="w-full">
          <Link to="/signup">Start free trial</Link>
        </Button>
      </div>
    </motion.div>
  );
}

/* ─── Content Renderer ─── */
function BlogContent({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/).map(b => b.trim()).filter(Boolean);

  const formatInline = (text: string) => {
    const formatted = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary hover:underline font-medium">$1</a>');
    return <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatted) }} />;
  };

  return (
    <div className="blog-content">
      {blocks.map((block, index) => {
        // H2
        if (block.startsWith("## ")) {
          const text = block.replace("## ", "");
          const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          return (
            <h2 key={index} id={id} className="text-2xl lg:text-[1.75rem] font-bold text-foreground mt-14 mb-5 scroll-mt-28 leading-tight">
              {text}
            </h2>
          );
        }
        // H3 (FAQ)
        if (block.startsWith("### ")) {
          const text = block.replace("### ", "");
          return (
            <h3 key={index} className="text-xl font-semibold text-foreground mt-10 mb-3 leading-snug">
              {text}
            </h3>
          );
        }
        // Unordered lists
        if (block.includes("\n- ")) {
          const items = block.split("\n").filter(l => l.startsWith("- "));
          return (
            <ul key={index} className="space-y-3 my-5 ml-1">
              {items.map((item, i) => (
                <li key={i} className="flex gap-3 text-muted-foreground leading-relaxed">
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2.5" />
                  {formatInline(item.replace("- ", ""))}
                </li>
              ))}
            </ul>
          );
        }
        // Ordered lists
        if (block.match(/^\d+\. /m)) {
          const items = block.split("\n").filter(l => l.match(/^\d+\. /));
          return (
            <ol key={index} className="space-y-3 my-5 ml-1">
              {items.map((item, i) => (
                <li key={i} className="flex gap-3 text-muted-foreground leading-relaxed">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {formatInline(item.replace(/^\d+\. /, ""))}
                </li>
              ))}
            </ol>
          );
        }
        // Blockquote
        if (block.startsWith("> ")) {
          const text = block.replace(/^> /gm, "");
          return (
            <blockquote key={index} className="border-l-4 border-primary/40 pl-5 py-3 my-8 bg-primary/[0.03] rounded-r-xl">
              <p className="text-muted-foreground italic leading-relaxed whitespace-pre-line">{text}</p>
            </blockquote>
          );
        }
        // HR
        if (block.trim() === "---") {
          return <hr key={index} className="my-10 border-border/50" />;
        }
        // Bold paragraph
        if (block.startsWith("**") && block.endsWith("**")) {
          return (
            <p key={index} className="font-semibold text-foreground mb-4 leading-relaxed">
              {block.replace(/\*\*/g, "")}
            </p>
          );
        }
        // Regular paragraph
        if (block.trim()) {
          const formatted = block
            .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary hover:underline font-medium">$1</a>');
          return (
            <p
              key={index}
              className="text-muted-foreground leading-[1.85] mb-5 text-[1.0625rem]"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatted) }}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

/* ─── Main Component ─── */
export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPostType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeHeadingId, setActiveHeadingId] = useState("");

  useEffect(() => {
    if (!slug) return;
    import("@/data/blogPosts").then(mod => {
      const found = mod.getPostBySlug(slug);
      if (!found) { navigate("/blog", { replace: true }); return; }
      setPost(found);
      setRelatedPosts(mod.getRelatedPosts(found.relatedPosts));
      setIsLoading(false);
    });
  }, [slug, navigate]);

  // Track active heading for ToC
  useEffect(() => {
    if (!post) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) setActiveHeadingId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    const headingEls = document.querySelectorAll("h2[id]");
    headingEls.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [post, isLoading]);

  usePageMeta(
    post ? `${post.title} | LessonLoop Blog` : "Blog | LessonLoop",
    post?.excerpt || "Music teaching tips, product updates, and industry insights"
  );

  if (isLoading || !post) {
    return (
      <MarketingLayout>
        <section className="pt-28 pb-12 lg:pt-36 lg:pb-16">
          <div className="container mx-auto px-5 sm:px-6 lg:px-8 space-y-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        </section>
      </MarketingLayout>
    );
  }

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const headings = post.content.match(/^## .+$/gm)?.map(h => ({
    id: h.replace("## ", "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    text: h.replace("## ", ""),
  })) || [];

  // Build FAQ schema from ### headings after "Frequently Asked Questions"
  const faqContent = post.content.split("## Frequently Asked Questions")[1] || "";
  const faqItems: { question: string; answer: string }[] = [];
  const faqMatches = faqContent.split("### ").filter(Boolean);
  faqMatches.forEach(block => {
    const lines = block.trim().split("\n").filter(Boolean);
    if (lines.length >= 2) {
      faqItems.push({ question: lines[0], answer: lines.slice(1).join(" ").trim() });
    }
  });

  return (
    <MarketingLayout>
      <ReadingProgress />

      {/* JSON-LD BlogPosting */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.excerpt,
          image: `https://lessonloop.net${post.featuredImage}`,
          datePublished: new Date().toISOString().split("T")[0],
          author: { "@type": "Organization", name: "LessonLoop" },
          publisher: {
            "@type": "Organization",
            name: "LessonLoop",
            logo: { "@type": "ImageObject", url: "https://lessonloop.net/logo-horizontal.svg" },
          },
          mainEntityOfPage: { "@type": "WebPage", "@id": currentUrl },
        }),
      }} />

      {/* JSON-LD FAQPage */}
      {faqItems.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqItems.map(faq => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          }),
        }} />
      )}

      {/* ═══ HERO ═══ */}
      <section className="relative pt-28 pb-10 sm:pt-32 lg:pt-40 lg:pb-14 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <motion.div className="absolute top-10 -left-40 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)" }} />

        <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Link to="/blog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>

            <div className="flex flex-wrap items-center gap-3 mb-5">
              <Badge variant="secondary" className="bg-primary/10 text-primary font-semibold px-3 py-1">
                {post.category}
              </Badge>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {post.readTime} read
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-[1.15] tracking-tight mb-8 max-w-4xl">
              {post.title}
            </h1>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[hsl(var(--teal))] to-[hsl(var(--primary))] flex items-center justify-center shadow-md">
                  <span className="text-white font-bold text-sm">LL</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{post.author.name}</p>
                  <p className="text-xs text-muted-foreground">{post.author.role}</p>
                </div>
              </div>
              <ShareButtons url={currentUrl} title={post.title} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ FEATURED IMAGE ═══ */}
      <section className="pb-8">
        <div className="container mx-auto px-5 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-2xl lg:rounded-3xl overflow-hidden border border-border/60 bg-card shadow-lg"
          >
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-56 sm:h-72 lg:h-[420px] object-cover"
              loading="eager"
              width={1200}
              height={420}
            />
          </motion.div>
        </div>
      </section>

      {/* ═══ MOBILE TOC ═══ */}
      {headings.length > 0 && (
        <section className="lg:hidden pb-6">
          <div className="container mx-auto px-5 sm:px-6">
            <details className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
              <summary className="flex items-center gap-2 p-4 cursor-pointer text-sm font-bold text-foreground">
                <List className="w-4 h-4 text-primary" />
                Table of Contents
                <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground transition-transform [[open]>&]:rotate-90" />
              </summary>
              <nav className="px-4 pb-4 space-y-1">
                {headings.map((heading, i) => (
                  <a
                    key={heading.id}
                    href={`#${heading.id}`}
                    className="flex items-center gap-2.5 py-2 px-3 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all"
                  >
                    <span className="w-5 h-5 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                    {heading.text}
                  </a>
                ))}
              </nav>
            </details>
          </div>
        </section>
      )}

      {/* ═══ CONTENT + SIDEBAR ═══ */}
      <section className="py-6 lg:py-12">
        <div className="container mx-auto px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
            {/* Main Content */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex-1 min-w-0 max-w-3xl"
            >
              <BlogContent content={post.content} />

              {/* Tags */}
              <div className="mt-14 pt-8 border-t border-border/50">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="capitalize text-xs px-3 py-1">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Bottom Share */}
              <div className="mt-8 pt-8 border-t border-border/50 flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Enjoyed this article?</p>
                <ShareButtons url={currentUrl} title={post.title} />
              </div>
            </motion.article>

            {/* Sidebar */}
            <aside className="hidden lg:block lg:w-80 flex-shrink-0">
              <div className="sticky top-28 space-y-6">
                <TableOfContents headings={headings} activeId={activeHeadingId} />
                <SidebarCTA />
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ═══ RELATED ARTICLES ═══ */}
      {relatedPosts.length > 0 && (
        <section className="py-16 lg:py-20 bg-muted/30">
          <div className="container mx-auto px-5 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-foreground mb-8">Related Articles</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {relatedPosts.map((rp, index) => (
                <motion.article key={rp.slug} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                  <Link to={`/blog/${rp.slug}`} className="group block">
                    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all">
                      <img src={rp.featuredImage} alt={rp.title} className="w-full h-48 object-cover" loading="lazy" />
                      <div className="p-6">
                        <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary">{rp.category}</Badge>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">{rp.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{rp.excerpt}</p>
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ FINAL CTA ═══ */}
      <section className="border-t border-border/40 bg-[hsl(var(--ink))] py-16 lg:py-20">
        <div className="container mx-auto px-5 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[hsl(var(--teal))] text-xs font-semibold mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            Built for UK music schools
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
            Ready to transform your teaching practice?
          </h2>
          <p className="text-white/50 mb-8 max-w-2xl mx-auto">
            Join a growing community of UK music teachers who save hours every week with LessonLoop's{" "}
            <Link to="/features/scheduling" className="text-[hsl(var(--teal))] hover:underline font-medium">scheduling</Link>,{" "}
            <Link to="/features/billing" className="text-[hsl(var(--teal))] hover:underline font-medium">billing</Link>, and{" "}
            <Link to="/features/parent-portal" className="text-[hsl(var(--teal))] hover:underline font-medium">parent portal</Link>.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] text-white shadow-lg hover:shadow-xl">
              <Link to="/signup">Start Your Free Trial</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
              <Link to="/features">Explore Features</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
