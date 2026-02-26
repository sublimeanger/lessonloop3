import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import { useParams, Link, useNavigate } from "react-router-dom";
import { sanitizeHtml } from "@/lib/sanitize";
import { motion } from "framer-motion";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock, User, Share2, Twitter, Linkedin, Copy, Check } from "lucide-react";
import type { BlogPost as BlogPostType } from "@/data/blogPosts";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPostType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    import("@/data/blogPosts").then(mod => {
      const found = mod.getPostBySlug(slug);
      if (!found) {
        navigate("/blog", { replace: true });
        return;
      }
      setPost(found);
      setRelatedPosts(mod.getRelatedPosts(found.relatedPosts));
      setIsLoading(false);
    });
  }, [slug, navigate]);

  usePageMeta(
    post ? `${post.title} | LessonLoop Blog` : 'Blog | LessonLoop',
    post?.excerpt || 'Music teaching tips, product updates, and industry insights'
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
  const currentUrl = window.location.href;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error("Failed to copy link:", err);
    }
  };

  const handleShareTwitter = () => {
    const tweetText = encodeURIComponent(`${post.title} - Great read for music teachers!`);
    const tweetUrl = encodeURIComponent(currentUrl);
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`, "_blank", "noopener,noreferrer");
  };

  const handleShareLinkedIn = () => {
    const linkedInUrl = encodeURIComponent(currentUrl);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${linkedInUrl}`, "_blank", "noopener,noreferrer");
  };

  // Extract headings from content for table of contents
  const headings = post.content.match(/^## .+$/gm)?.map(h => ({
    id: h.replace("## ", "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    text: h.replace("## ", "")
  })) || [];

  // Convert markdown-style content to HTML
  const formatContent = (content: string) => {
    const blocks = content
      .split(/\n\n+/)
      .map(block => block.trim())
      .filter(block => block.length > 0);
    
    return blocks.map((block, index) => {
        // Headings
        if (block.startsWith("## ")) {
          const text = block.replace("## ", "");
          const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          return (
            <h2 key={index} id={id} className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
              {text}
            </h2>
          );
        }
        if (block.startsWith("### ")) {
          const text = block.replace("### ", "");
          return (
            <h3 key={index} className="text-xl font-semibold text-foreground mt-8 mb-3">
              {text}
            </h3>
          );
        }
        
        // Helper to format inline text (bold, links)
        const formatInline = (text: string) => {
          // Handle bold and links
          const formatted = text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
          return <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatted) }} />;
        };

        // Lists
        if (block.includes("\n- ")) {
          const items = block.split("\n").filter(line => line.startsWith("- "));
          return (
            <ul key={index} className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
              {items.map((item, i) => (
                <li key={i}>{formatInline(item.replace("- ", ""))}</li>
              ))}
            </ul>
          );
        }
        
        // Numbered lists
        if (block.match(/^\d+\. /m)) {
          const items = block.split("\n").filter(line => line.match(/^\d+\. /));
          return (
            <ol key={index} className="list-decimal list-inside space-y-2 text-muted-foreground mb-4">
              {items.map((item, i) => (
                <li key={i}>{formatInline(item.replace(/^\d+\. /, ""))}</li>
              ))}
            </ol>
          );
        }
        
        // Block quotes
        if (block.startsWith("> ")) {
          const text = block.replace(/^> /gm, "");
          return (
            <blockquote key={index} className="border-l-4 border-primary pl-4 py-2 my-6 bg-primary/5 rounded-r-lg">
              <p className="text-muted-foreground italic whitespace-pre-line">{text}</p>
            </blockquote>
          );
        }
        
        // Bold text handling
        if (block.startsWith("**") && block.endsWith("**")) {
          return (
            <p key={index} className="font-semibold text-foreground mb-4">
              {block.replace(/\*\*/g, "")}
            </p>
          );
        }
        
        // Tables
        if (block.includes("|") && block.includes("---")) {
          const lines = block.split("\n").filter(l => l.trim());
          if (lines.length >= 2) {
            const headers = lines[0].split("|").filter(h => h.trim()).map(h => h.trim());
            const rows = lines.slice(2).map(row => 
              row.split("|").filter(c => c.trim()).map(c => c.trim())
            );
            return (
              <div key={index} className="overflow-x-auto my-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {headers.map((h, i) => (
                        <th key={i} className="text-left py-2 px-3 font-semibold text-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-border/50">
                        {row.map((cell, ci) => (
                          <td key={ci} className="py-2 px-3 text-muted-foreground">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }
        
        // Horizontal rules
        if (block.trim() === "---") {
          return <hr key={index} className="my-8 border-border" />;
        }
        
        // Regular paragraphs
        if (block.trim()) {
          // Handle inline formatting
          const formattedText = block
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
          
          return (
            <p 
              key={index} 
              className="text-muted-foreground leading-relaxed mb-4"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(formattedText) }}
            />
          );
        }
        
        return null;
      });
  };

  return (
    <MarketingLayout>
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": post.title,
          "description": post.excerpt,
          "image": `https://lessonloop.net${post.featuredImage}`,
          "datePublished": new Date().toISOString().split('T')[0],
          "author": {
            "@type": "Person",
            "name": post.author.name,
            "jobTitle": post.author.role
          },
          "publisher": {
            "@type": "Organization",
            "name": "LessonLoop",
            "logo": {
              "@type": "ImageObject",
              "url": "https://lessonloop.net/logo-horizontal.svg"
            }
          },
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": currentUrl
          }
        })
      }} />

      {/* Hero Section */}
      <section className="pt-28 pb-12 sm:pt-32 lg:pt-40 lg:pb-16 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero-light" />

        <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link 
              to="/blog" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {post.category}
              </Badge>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {post.readTime}
              </span>
              {/* Date intentionally hidden — evergreen content */}
            </div>

            <h1 className="text-3xl lg:text-5xl font-bold text-foreground leading-tight mb-6 max-w-4xl">
              {post.title}
            </h1>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-medium text-foreground">{post.author.name}</p>
                <p className="text-sm text-muted-foreground">{post.author.role}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Image */}
      <section className="pb-8">
        <div className="container mx-auto px-5 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-2xl overflow-hidden border border-border bg-card"
          >
            <img 
              src={post.featuredImage} 
              alt={post.title}
              className="w-full h-64 lg:h-96 object-cover"
              loading="eager"
            />
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-8 lg:py-12">
        <div className="container mx-auto px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Main Content */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex-1 max-w-3xl"
            >
              <div className="prose prose-lg max-w-none">
                {formatContent(post.content)}
              </div>

              {/* Tags */}
              <div className="mt-12 pt-8 border-t border-border">
                <p className="text-sm font-medium text-foreground mb-3">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="capitalize">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Share */}
              <div className="mt-8 pt-8 border-t border-border">
                <p className="text-sm font-medium text-foreground mb-3">Share this article</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyLink}>
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleShareTwitter}>
                    <Twitter className="w-4 h-4 mr-2" />
                    Twitter
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleShareLinkedIn}>
                    <Linkedin className="w-4 h-4 mr-2" />
                    LinkedIn
                  </Button>
                </div>
              </div>
            </motion.article>

            {/* Sidebar */}
            <aside className="lg:w-80">
              <div className="sticky top-28 space-y-8">
                {/* Table of Contents */}
                {headings.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="rounded-xl border border-border bg-card p-6"
                  >
                    <h3 className="font-semibold text-foreground mb-4">Contents</h3>
                    <nav className="space-y-2">
                      {headings.map(heading => (
                        <a
                          key={heading.id}
                          href={`#${heading.id}`}
                          className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {heading.text}
                        </a>
                      ))}
                    </nav>
                  </motion.div>
                )}

                {/* CTA */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="rounded-xl border border-primary/20 bg-primary/5 p-6"
                >
                  <h3 className="font-semibold text-foreground mb-2">Ready to simplify your teaching?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Try LessonLoop free for 30 days. No credit card required.
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/signup">Start free trial</Link>
                  </Button>
                </motion.div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Related Articles */}
      {relatedPosts.length > 0 && (
        <section className="py-16 lg:py-20 bg-muted/30">
          <div className="container mx-auto px-5 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-foreground mb-8">Related Articles</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {relatedPosts.map((relatedPost, index) => (
                <motion.article
                  key={relatedPost.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link to={`/blog/${relatedPost.slug}`} className="group block">
                    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all">
                      <img 
                        src={relatedPost.featuredImage} 
                        alt={relatedPost.title}
                        className="w-full h-48 object-cover"
                        loading="lazy"
                      />
                      <div className="p-6">
                        <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary">
                          {relatedPost.category}
                        </Badge>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                          {relatedPost.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {relatedPost.excerpt}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-5 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-4">
            Ready to transform your teaching practice?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join a growing community of UK music teachers who save hours every week with LessonLoop's 
            all-in-one scheduling, invoicing, and parent communication platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/signup">Start Your Free Trial</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/features">Explore Features</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
