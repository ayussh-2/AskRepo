import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const typographyVariants = cva("", {
  variants: {
    variant: {
      "display-xl": "text-[80px] font-semibold leading-[1.05] tracking-[-3px]",
      "display-lg": "text-[56px] font-semibold leading-[1.10] tracking-[-1.8px]",
      "display-md": "text-[40px] font-semibold leading-[1.15] tracking-[-1.0px]",
      headline: "text-[28px] font-semibold leading-[1.20] tracking-[-0.6px]",
      "card-title": "text-[22px] font-medium leading-[1.25] tracking-[-0.4px]",
      subhead: "text-[20px] font-normal leading-[1.40] tracking-[-0.2px]",
      "body-lg": "text-[18px] font-normal leading-[1.50] tracking-[-0.1px]",
      body: "text-[16px] font-normal leading-[1.50] tracking-[-0.05px]",
      "body-sm": "text-[14px] font-normal leading-[1.50] tracking-normal",
      caption: "text-[12px] font-normal leading-[1.40] tracking-normal",
      button: "text-[14px] font-medium leading-[1.20] tracking-normal",
      eyebrow: "text-[13px] font-medium leading-[1.30] tracking-[0.4px] uppercase",
      mono: "text-[13px] font-normal leading-[1.50] tracking-normal font-mono",
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

export interface TypographyProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof typographyVariants> {
  as?: React.ElementType;
}

const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ className, variant, as, ...props }, ref) => {
    const Component = as || getDefaultElement(variant);
    return (
      <Component
        className={cn(typographyVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Typography.displayName = "Typography";

function getDefaultElement(variant: VariantProps<typeof typographyVariants>["variant"]) {
  switch (variant) {
    case "display-xl":
    case "display-lg":
      return "h1";
    case "display-md":
      return "h2";
    case "headline":
      return "h3";
    case "card-title":
      return "h4";
    case "subhead":
      return "p";
    case "body-lg":
    case "body":
    case "body-sm":
      return "p";
    case "caption":
      return "span";
    case "eyebrow":
      return "span";
    case "mono":
      return "code";
    default:
      return "p";
  }
}

export { Typography, typographyVariants };
