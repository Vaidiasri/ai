---
description: Execute UI development with the precision and standards of a 25-year Senior Frontend Architect.
---

# UI Master Workflow

This workflow enforces the rigorous standards of elite frontend engineering, prioritizing pixel perfection, semantic HTML, accessibility (a11y), and performant animations.

## 1. Architectural Analysis & Component Strategy

Before writing a single line of CSS, deconstruct the design intent.

- **Identify Core Components**: Break down the UI into atomic, reusable units (atoms, molecules, organisms).
- **Define State Strategy**: Determine which state is local (useState) vs global (Zustand/Context).
- **Semantics First**: Plan the HTML structure using proper semantic tags (`<header>`, `<main>`, `<article>`, `<aside>`, `<nav>`) to ensure accessibility and SEO.

## 2. Structural Implementation (The Skeleton)

Build the layout with robust, responsive foundations.

- **Grid & Flexbox Mastery**: Use `grid` for macro-layouts and `flex` for component alignment. Avoid fixed dimensions; use relative units (`rem`, `%`, `vh/vw`).
- **Responsive by Default**: Implement mobile-first media queries. Ensure the layout adapts fluidly to all viewports.
- **Content Hierarchy**: Use proper heading levels (`h1`-`h6`) and logical document flow.

## 3. Visual Excellence & Design Systems (The Skin)

Apply styling with obsessive attention to detail, adhering to the design system.

- **Typography**: strict adherence to font scales, line-heights (`leading`), and letter-spacing (`tracking`) for optimal readability.
- **Color & Contrast**: enforce WCAG AA/AAA contrast ratios. Use semantic color variables (e.g., `bg-primary`, `text-muted`) for theme adaptability.
- **Spacing**: Use a consistent spacing scale (4px grid). "Whitespace is an active design element, not empty space."

## 4. Advanced Polish & Micro-Interactions (The Soul)

Elevate the experience from "functional" to "premium".

- **Glassmorphism & Depth**: Layer transparency (`backdrop-blur`), borders (`border-white/10`), and shadows to create depth hierarchy.
- **Meaningful Motion**: Add subtle entry animations (`animate-in`, `fade-in`), hover transitions, and state changes. Animations should be physics-based and imperceptible (<300ms).
- **Active States**: ensure every interactive element has distinct `:hover`, `:active`, and `:focus-visible` states.

## 5. Review & Optimization (The Quality Gate)

- **Accessibility Audit**: Verify keyboard navigation (Tab index), ARIA labels, and screen reader compatibility.
- **Performance**: Optimize images (`next/image`), lazy load non-critical components, and minimize layout shifts (CLS).
- **Cross-Browser Verification**: Ensure consistent rendering across Chrome, Firefox, Safari, and Edge.

> "Good design is obvious. Great design is transparent."
