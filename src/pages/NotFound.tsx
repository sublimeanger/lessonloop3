import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Calendar, HelpCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoHorizontal } from '@/components/brand/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';

const NotFound = () => {
  usePageMeta('Page Not Found | LessonLoop', 'The page you are looking for does not exist');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gradient-hero-light p-4">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <Link to="/">
          <LogoHorizontal size="lg" />
        </Link>
      </motion.div>

      {/* 404 Text */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-center"
      >
        <h1 className="text-8xl font-bold text-primary/20 sm:text-9xl">404</h1>
        <h2 className="mt-4 text-2xl font-semibold text-foreground sm:text-3xl">
          Page not found
        </h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-8 flex flex-col gap-3 sm:flex-row"
      >
        <Button asChild className="gap-2">
          <Link to="/dashboard">
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/calendar">
            <Calendar className="h-4 w-4" />
            View Calendar
          </Link>
        </Button>
        <Button asChild variant="ghost" className="gap-2">
          <Link to="/help">
            <HelpCircle className="h-4 w-4" />
            Get Help
          </Link>
        </Button>
      </motion.div>

      {/* Back Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-12"
      >
        <Button
          variant="link"
          className="gap-1 text-muted-foreground"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Button>
      </motion.div>
    </div>
  );
};

export default NotFound;
