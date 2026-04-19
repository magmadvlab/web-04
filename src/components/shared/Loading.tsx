"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: "spinner" | "skeleton" | "pulse";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Loading({ variant = "spinner", size = "md", className }: LoadingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  if (variant === "skeleton") {
    return (
      <div className={cn("space-y-2 p-8", className)}>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <motion.div
          className={cn("rounded-full bg-primary", sizeClasses[size])}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.7, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center p-8", className)}>
      <motion.div
        className={cn(
          "animate-spin rounded-full border-4 border-primary border-t-transparent",
          sizeClasses[size]
        )}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}

