"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ModernCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "gradient";
  delay?: number;
  hover?: boolean;
}

const ModernCard = React.forwardRef<HTMLDivElement, ModernCardProps>(
  ({ className, variant = "default", delay = 0, hover = true, children, ...props }, ref) => {
    const baseClasses = "rounded-lg border bg-card text-card-foreground shadow-sm";
    
    const variantClasses = {
      default: "",
      glass: "glass border-white/20",
      gradient: "gradient-card border-white/10",
    };

    const content = (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          hover && "hover-lift",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );

    if (variant === "default") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay }}
        >
          {content}
        </motion.div>
      );
    }

    return content;
  }
);
ModernCard.displayName = "ModernCard";

const ModernCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
ModernCardHeader.displayName = "ModernCardHeader";

const ModernCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
ModernCardTitle.displayName = "ModernCardTitle";

const ModernCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
ModernCardContent.displayName = "ModernCardContent";

export { ModernCard, ModernCardHeader, ModernCardTitle, ModernCardContent };


