import { motion } from "framer-motion";

const APP_STORE_URL = "https://apps.apple.com/app/id6759724798";

interface AppStoreBadgeProps {
  variant?: "black" | "white";
  className?: string;
}

/**
 * Official Apple "Download on the App Store" badge.
 * Available in black (for light backgrounds) and white (for dark backgrounds).
 */
export function AppStoreBadge({ variant = "black", className = "" }: AppStoreBadgeProps) {
  const isWhite = variant === "white";
  const fillColor = isWhite ? "#fff" : "#000";
  const textColor = isWhite ? "#000" : "#fff";
  const borderColor = isWhite ? "rgba(255,255,255,0.2)" : "#A6A6A6";

  return (
    <motion.a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      className={`inline-flex ${className}`}
      aria-label="Download on the App Store"
    >
      <svg
        viewBox="0 0 120 40"
        xmlns="http://www.w3.org/2000/svg"
        className="h-[40px] w-[120px] sm:h-[48px] sm:w-[144px]"
      >
        {/* Badge background */}
        <rect width="120" height="40" rx="6" fill={fillColor} />
        <rect x="0.5" y="0.5" width="119" height="39" rx="5.5" stroke={borderColor} fill="none" />

        {/* Apple logo */}
        <g transform="translate(8, 6)" fill={textColor}>
          <path d="M15.769 13.298c-.03-3.223 2.652-4.79 2.774-4.863-1.517-2.208-3.87-2.51-4.699-2.537-1.976-.206-3.896 1.187-4.907 1.187-1.027 0-2.575-1.168-4.244-1.134-2.147.034-4.163 1.28-5.267 3.22-2.278 3.937-.58 9.72 1.601 12.908 1.091 1.559 2.369 3.297 4.038 3.235 1.634-.067 2.243-1.04 4.216-1.04 1.957 0 2.531 1.04 4.233.998 1.749-.028 2.854-1.57 3.908-3.143 1.265-1.789 1.775-3.556 1.792-3.649-.04-.015-3.412-1.299-3.445-5.182z" />
          <path d="M12.553 3.892C13.44 2.8 14.043 1.297 13.875 0c-1.284.056-2.897.89-3.822 1.962-.818.948-1.55 2.508-1.362 3.972 1.445.107 2.93-.733 3.862-2.042z" />
        </g>

        {/* "Download on the" text */}
        <text x="38" y="14" fill={textColor} fontFamily="-apple-system, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif" fontSize="6.2" fontWeight="400" letterSpacing="0.02em">
          Download on the
        </text>

        {/* "App Store" text */}
        <text x="38" y="30" fill={textColor} fontFamily="-apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif" fontSize="12.5" fontWeight="600" letterSpacing="-0.01em">
          App Store
        </text>
      </svg>
    </motion.a>
  );
}
