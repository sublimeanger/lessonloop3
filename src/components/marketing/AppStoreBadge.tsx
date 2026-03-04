import { motion } from "framer-motion";

const APP_STORE_URL = "https://apps.apple.com/app/id6759724798";

interface AppStoreBadgeProps {
  variant?: "black" | "white";
  className?: string;
}

export function AppStoreBadge({ variant = "black", className = "" }: AppStoreBadgeProps) {
  const src = variant === "white"
    ? "/images/app-store-badge-white.svg"
    : "/images/app-store-badge-black.svg";

  return (
    <motion.a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      className={`inline-block ${className}`}
      aria-label="Download on the App Store"
    >
      <img
        src={src}
        alt="Download on the App Store"
        className="h-[40px] w-auto sm:h-[48px]"
        loading="eager"
      />
    </motion.a>
  );
}
