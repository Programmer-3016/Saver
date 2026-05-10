// Shared Tailwind theme for every static Saver page.
// Tokens are driven by CSS variables so each page can switch visual modes without duplicating config.

(function () {
  window.tailwind = window.tailwind || {};
  window.tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          "primary-container": "rgb(var(--color-primary-container) / <alpha-value>)",
          "on-primary-container": "rgb(var(--color-on-primary-container) / <alpha-value>)",
          "on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
          "on-primary-fixed-variant": "rgb(var(--color-on-primary-fixed-variant) / <alpha-value>)",
          "inverse-surface": "rgb(var(--color-inverse-surface) / <alpha-value>)",
          "surface-container-highest":
            "rgb(var(--color-surface-container-highest) / <alpha-value>)",
          "on-tertiary-fixed": "rgb(var(--color-on-tertiary-fixed) / <alpha-value>)",
          background: "rgb(var(--color-background) / <alpha-value>)",
          "tertiary-fixed-dim": "rgb(var(--color-tertiary-fixed-dim) / <alpha-value>)",
          "on-secondary-container": "rgb(var(--color-on-secondary-container) / <alpha-value>)",
          "surface-bright": "rgb(var(--color-surface-bright) / <alpha-value>)",
          "on-tertiary": "rgb(var(--color-on-tertiary) / <alpha-value>)",
          "surface-container": "rgb(var(--color-surface-container) / <alpha-value>)",
          tertiary: "rgb(var(--color-tertiary) / <alpha-value>)",
          "error-container": "rgb(var(--color-error-container) / <alpha-value>)",
          "on-background": "rgb(var(--color-on-background) / <alpha-value>)",
          outline: "rgb(var(--color-outline) / <alpha-value>)",
          "outline-variant": "rgb(var(--color-outline-variant) / <alpha-value>)",
          "on-surface-variant": "rgb(var(--color-on-surface-variant) / <alpha-value>)",
          "on-tertiary-container": "rgb(var(--color-on-tertiary-container) / <alpha-value>)",
          "inverse-on-surface": "rgb(var(--color-inverse-on-surface) / <alpha-value>)",
          "surface-container-lowest": "rgb(var(--color-surface-container-lowest) / <alpha-value>)",
          "secondary-fixed": "rgb(var(--color-secondary-fixed) / <alpha-value>)",
          "on-error": "rgb(var(--color-on-error) / <alpha-value>)",
          "secondary-container": "rgb(var(--color-secondary-container) / <alpha-value>)",
          "surface-container-low": "rgb(var(--color-surface-container-low) / <alpha-value>)",
          "primary-fixed": "rgb(var(--color-primary-fixed) / <alpha-value>)",
          primary: "rgb(var(--color-primary) / <alpha-value>)",
          error: "rgb(var(--color-error) / <alpha-value>)",
          "on-secondary": "rgb(var(--color-on-secondary) / <alpha-value>)",
          "primary-fixed-dim": "rgb(var(--color-primary-fixed-dim) / <alpha-value>)",
          "on-primary-fixed": "rgb(var(--color-on-primary-fixed) / <alpha-value>)",
          "on-tertiary-fixed-variant":
            "rgb(var(--color-on-tertiary-fixed-variant) / <alpha-value>)",
          "surface-container-high": "rgb(var(--color-surface-container-high) / <alpha-value>)",
          "surface-dim": "rgb(var(--color-surface-dim) / <alpha-value>)",
          "on-error-container": "rgb(var(--color-on-error-container) / <alpha-value>)",
          "tertiary-fixed": "rgb(var(--color-tertiary-fixed) / <alpha-value>)",
          "surface-variant": "rgb(var(--color-surface-variant) / <alpha-value>)",
          secondary: "rgb(var(--color-secondary) / <alpha-value>)",
          surface: "rgb(var(--color-surface) / <alpha-value>)",
          "tertiary-container": "rgb(var(--color-tertiary-container) / <alpha-value>)",
          "surface-tint": "rgb(var(--color-surface-tint) / <alpha-value>)",
          "on-secondary-fixed": "rgb(var(--color-on-secondary-fixed) / <alpha-value>)",
          "on-surface": "rgb(var(--color-on-surface) / <alpha-value>)",
          "on-secondary-fixed-variant":
            "rgb(var(--color-on-secondary-fixed-variant) / <alpha-value>)",
          "inverse-primary": "rgb(var(--color-inverse-primary) / <alpha-value>)",
          "secondary-fixed-dim": "rgb(var(--color-secondary-fixed-dim) / <alpha-value>)",
          "on-primary-fixed-variant":
            "rgb(var(--color-on-primary-fixed-variant) / <alpha-value>)",
        },
        borderRadius: {
          DEFAULT: "var(--radius-default)",
          lg: "var(--radius-lg)",
          xl: "var(--radius-xl)",
          full: "var(--radius-full)",
        },
        spacing: {
          xs: "var(--space-xs)",
          sm: "var(--space-sm)",
          base: "var(--space-base)",
          md: "var(--space-md)",
          lg: "var(--space-lg)",
          xl: "var(--space-xl)",
          gutter: "var(--space-gutter)",
          "margin-mobile": "var(--space-margin-mobile)",
          "margin-desktop": "var(--space-margin-desktop)",
          unit: "var(--space-unit)",
          "stack-sm": "var(--space-stack-sm)",
          "stack-md": "var(--space-stack-md)",
          "stack-lg": "var(--space-stack-lg)",
          "section-gap": "var(--space-section-gap)",
          "container-padding": "var(--space-container-padding)",
          "grid-gutter": "16px",
          "card-gap": "12px",
        },
        fontFamily: {
          h1: ['"Plus Jakarta Sans"', "sans-serif"],
          h2: ['"Plus Jakarta Sans"', "sans-serif"],
          h3: ['"Plus Jakarta Sans"', "sans-serif"],
          display: ['"Plus Jakarta Sans"', "sans-serif"],
          "body-sm": ["Inter", "sans-serif"],
          "body-md": ["Inter", "sans-serif"],
          "body-lg": ["Inter", "sans-serif"],
          "label-caps": ["Inter", "sans-serif"],
          "currency-display": ['"Plus Jakarta Sans"', "sans-serif"],
          "label-pill": ["Inter", "sans-serif"],
        },
        fontSize: {
          "label-caps": [
            "var(--font-size-label-caps)",
            {
              lineHeight: "var(--line-height-label-caps)",
              letterSpacing: "var(--tracking-label-caps)",
              fontWeight: "var(--font-weight-label-caps)",
            },
          ],
          display: [
            "var(--font-size-display)",
            {
              lineHeight: "var(--line-height-display)",
              letterSpacing: "var(--tracking-display)",
              fontWeight: "var(--font-weight-display)",
            },
          ],
          h1: [
            "var(--font-size-h1)",
            {
              lineHeight: "var(--line-height-h1)",
              letterSpacing: "var(--tracking-h1)",
              fontWeight: "var(--font-weight-h1)",
            },
          ],
          h2: [
            "var(--font-size-h2)",
            {
              lineHeight: "var(--line-height-h2)",
              fontWeight: "var(--font-weight-h2)",
            },
          ],
          h3: [
            "var(--font-size-h3)",
            {
              lineHeight: "var(--line-height-h3)",
              fontWeight: "var(--font-weight-h3)",
            },
          ],
          "body-sm": [
            "var(--font-size-body-sm)",
            {
              lineHeight: "var(--line-height-body-sm)",
              fontWeight: "var(--font-weight-body-sm)",
            },
          ],
          "body-md": [
            "var(--font-size-body-md)",
            {
              lineHeight: "var(--line-height-body-md)",
              fontWeight: "var(--font-weight-body-md)",
            },
          ],
          "body-lg": [
            "var(--font-size-body-lg)",
            {
              lineHeight: "var(--line-height-body-lg)",
              fontWeight: "var(--font-weight-body-lg)",
            },
          ],
          "currency-display": [
            "28px",
            {
              lineHeight: "1.0",
              fontWeight: "700",
            },
          ],
          "label-pill": [
            "13px",
            {
              lineHeight: "1.0",
              fontWeight: "600",
            },
          ],
        },
        boxShadow: {
          "soft-green": "0 4px 24px rgba(27, 67, 50, 0.05)",
        },
      },
    },
  };
})();
