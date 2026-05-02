// Shared UI renderers for plain HTML pages.
// Each renderer turns small placeholder blocks into reusable page sections that can later map to real components.
(function () {
  const navigationItems = [
    { key: "home", label: "Home", href: "#home" },
    { key: "features", label: "Features", href: "#features" },
    { key: "testimonials", label: "Testimonials", href: "#testimonials" },
    { key: "pricing", label: "Pricing", href: "#pricing" },
  ];

  const transactionFeed = [
    {
      title: "Blue Tokai Coffee",
      time: "Today, 10:45 AM",
      amountCompact: "- &#8377;280",
      amountFull: "- &#8377;280.00",
      badge: "FOOD",
      badgeClass: "bg-orange-50 text-orange-700",
      icon: "local_cafe",
      iconWrapperClass: "bg-orange-100",
      iconClass: "text-orange-600",
    },
    {
      title: "Uber Trip",
      time: "Yesterday, 8:20 PM",
      amountCompact: "- &#8377;145",
      amountFull: "- &#8377;145.00",
      badge: "TRANSPORT",
      badgeClass: "bg-blue-50 text-blue-700",
      icon: "directions_bus",
      iconWrapperClass: "bg-blue-100",
      iconClass: "text-blue-600",
    },
    {
      title: "Project Payment",
      time: "22 Oct",
      amountCompact: "+ &#8377;12,000",
      amountFull: "+ &#8377;12,000.00",
      badge: "INCOME",
      badgeClass: "bg-emerald-100 text-primary-container",
      icon: "payments",
      iconWrapperClass: "bg-emerald-100",
      iconClass: "text-primary-container",
    },
  ];

  const authShellVariants = {
    login: {
      panelPadding: "px-gutter py-6 md:py-10",
      contentSpacing: "space-y-6 md:space-y-6",
      headingSpacing: "space-y-4 md:space-y-4",
      titleClass: "font-h1 text-[30px] leading-[1.15] md:text-h1 text-on-surface",
      descriptionClass: "font-body-md text-body-md text-secondary",
      dividerPadding: "py-3 md:py-3",
      alternatePadding: "pt-4 md:pt-4",
      googleButtonPadding: "py-3 md:py-3.5",
      brandWrapperClass: "md:absolute top-12 left-12 mb-4 md:mb-0",
      visual: "savings",
    },
    register: {
      panelPadding: "px-gutter py-5 md:py-6",
      contentSpacing: "space-y-4",
      headingSpacing: "space-y-2.5",
      titleClass: "font-h1 text-[28px] leading-[1.12] md:text-[30px] text-on-surface",
      descriptionClass: "font-body-sm text-body-sm text-secondary",
      dividerPadding: "py-1.5",
      alternatePadding: "pt-1",
      googleButtonPadding: "py-2.5",
      brandWrapperClass: "mb-1",
      visual: "transactions",
    },
  };

  const googleIcon = `
    <svg aria-hidden="true" class="w-5 h-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
    </svg>
  `;

  // Safely renders simple text into HTML attributes and text nodes.
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // Creates the consistent Saver brand lockup used by headers, footers, and auth pages.
  function renderBrandLockup(href, nameClass, iconClass) {
    return `
      <a class="flex items-center gap-2" href="${escapeHtml(href)}">
        <span class="material-symbols-outlined ${iconClass}">account_balance_wallet</span>
        <span class="${nameClass}">Saver</span>
      </a>
    `;
  }

  // Renders the shared Google button used across every auth entry point.
  function renderGoogleButton(extraClasses) {
    return `
      <button
        class="w-full flex items-center justify-center gap-3 px-6 ${extraClasses} border border-outline-variant rounded-full font-body-md text-on-surface hover:bg-surface-container-low transition-colors"
        data-google-auth
        type="button"
      >
        ${googleIcon}
        <span>Continue with Google</span>
      </button>
    `;
  }

  // Renders the repeated transaction rows so landing and register can share the same feed data.
  function renderTransactionRows(options) {
    const amountKey = options.amountKey;
    const rowClass = options.rowClass;
    const iconSizeClass = options.iconSizeClass;
    const titleClass = options.titleClass;
    const amountClass = options.amountClass;
    const timeClass = options.timeClass;
    const badgeClass = options.badgeClass;

    return transactionFeed
      .map((item) => {
        return `
          <div class="${rowClass}">
            <div class="flex items-center gap-4">
              <div class="w-11 h-11 rounded-full ${item.iconWrapperClass} flex items-center justify-center">
                <span class="material-symbols-outlined ${item.iconClass} ${iconSizeClass}">${item.icon}</span>
              </div>
              <div>
                <p class="${titleClass}">${item.title}</p>
                <p class="${timeClass}">${item.time}</p>
              </div>
            </div>
            <div class="text-right">
              <p class="${amountClass}">${item[amountKey]}</p>
              <span class="inline-flex mt-1 ${item.badgeClass} ${badgeClass}">${item.badge}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Renders the reusable Recent Transactions card used on the landing page.
  function renderLandingTransactionFeed(container) {
    container.outerHTML = `
      <div class="bg-white rounded-[32px] overflow-hidden border border-stone-100 shadow-lg">
        <div class="bg-primary-container px-8 py-6">
          <h3 class="font-h2 text-h2 text-on-primary">Recent Transactions</h3>
          <p class="font-body-sm text-body-sm text-on-primary-container mt-1">Automatically categorized</p>
        </div>
        <div class="p-6 md:p-8 space-y-6">
          ${renderTransactionRows({
            amountKey: "amountFull",
            rowClass: "flex items-center justify-between gap-4",
            iconSizeClass: "text-xl",
            titleClass: "font-h3 text-h3 text-primary text-sm",
            amountClass: "font-h3 text-h3 text-primary text-sm",
            timeClass: "font-body-sm text-body-sm text-secondary",
            badgeClass: "px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide",
          })}
        </div>
      </div>
    `;
  }

  // Renders the landing page navigation as a reusable section instead of repeating it in every page.
  function renderMarketingHeader(container) {
    const activeKey = container.dataset.active || "home";
    const ctaHref = container.dataset.ctaHref || "register.html";
    const ctaLabel = container.dataset.ctaLabel || "Get Started";
    const navLinks = navigationItems
      .map((item) => {
        const activeClasses =
          item.key === activeKey
            ? "text-[#0A4D3C] dark:text-emerald-400 font-semibold transition-colors"
            : "text-slate-500 dark:text-slate-400 hover:text-[#0A4D3C] dark:hover:text-emerald-300 transition-colors";

        return `<a class="${activeClasses}" href="${item.href}">${item.label}</a>`;
      })
      .join("");

    container.outerHTML = `
      <header class="sticky top-0 z-50 bg-[#F9F7F2] dark:bg-slate-950 border-b border-stone-200 dark:border-slate-800">
        <nav class="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          ${renderBrandLockup("index.html", "text-xl font-bold text-[#0A4D3C] dark:text-emerald-500 font-h3", "text-[#0A4D3C] dark:text-emerald-400")}
          <div class="hidden md:flex items-center gap-8 font-['Plus_Jakarta_Sans'] text-sm font-medium tracking-tight">
            ${navLinks}
          </div>
          <a class="bg-primary-container text-on-primary px-lg py-sm rounded-full font-label-caps text-label-caps hover:opacity-90 transition-opacity" href="${escapeHtml(ctaHref)}">
            ${escapeHtml(ctaLabel)}
          </a>
        </nav>
      </header>
    `;
  }

  // Renders the shared marketing footer used by the landing page.
  function renderMarketingFooter(container) {
    const privacyHref = container.dataset.privacyHref || "register.html";
    const termsHref = container.dataset.termsHref || "register.html";

    container.outerHTML = `
      <footer class="bg-surface-container py-16 border-t border-stone-200">
        <div class="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
          <div class="col-span-1 md:col-span-1">
            ${renderBrandLockup("index.html", "text-xl font-bold text-[#0A4D3C] font-h3", "text-[#0A4D3C]")}
            <p class="font-body-sm text-body-sm text-secondary mt-6">Mindful money management for the modern Indian lifestyle.</p>
          </div>
          <div>
            <h4 class="font-h3 text-h3 text-primary text-base mb-6">Product</h4>
            <ul class="space-y-4 font-body-sm text-body-sm text-secondary">
              <li><a class="hover:text-primary transition-colors" href="#features">Features</a></li>
              <li><a class="hover:text-primary transition-colors" href="#pricing">Pricing</a></li>
              <li><a class="hover:text-primary transition-colors" href="#testimonials">Security</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-h3 text-h3 text-primary text-base mb-6">Resources</h4>
            <ul class="space-y-4 font-body-sm text-body-sm text-secondary">
              <li><a class="hover:text-primary transition-colors" href="#demo">Blog</a></li>
              <li><a class="hover:text-primary transition-colors" href="#testimonials">Help Center</a></li>
              <li><a class="hover:text-primary transition-colors" href="#features">Guides</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-h3 text-h3 text-primary text-base mb-6">Connect</h4>
            <div class="flex gap-4">
              <a class="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:shadow-md transition-shadow" href="mailto:hello@saver.app">
                <span class="material-symbols-outlined text-primary text-xl">alternate_email</span>
              </a>
              <a class="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:shadow-md transition-shadow" href="register.html">
                <span class="material-symbols-outlined text-primary text-xl">share</span>
              </a>
            </div>
          </div>
        </div>
        <div class="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-stone-200 flex flex-col md:flex-row justify-between text-label-caps font-label-caps text-secondary gap-4">
          <p>&copy; 2026 Saver. All rights reserved.</p>
          <div class="flex gap-8">
            <a class="hover:text-primary" href="${escapeHtml(privacyHref)}">Privacy Policy</a>
            <a class="hover:text-primary" href="${escapeHtml(termsHref)}">Terms of Service</a>
          </div>
        </div>
      </footer>
    `;
  }

  // Renders the lightweight authenticated header variant used by verify.html.
  function renderAppHeader(container) {
    const homeHref = container.dataset.homeHref || "./index.html";
    const backHref = container.dataset.backHref || "./login.html";
    const backLabel = container.dataset.backLabel || "Back";

    container.outerHTML = `
      <header class="sticky top-0 z-40 bg-[#F9F7F2]/95 backdrop-blur border-b border-stone-200">
        <nav class="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          ${renderBrandLockup(homeHref, "text-xl font-bold text-[#0A4D3C] font-h3", "text-[#0A4D3C]")}
          <a class="text-sm font-semibold text-secondary hover:text-primary-container transition-colors" href="${escapeHtml(backHref)}">
            ${escapeHtml(backLabel)}
          </a>
        </nav>
      </header>
    `;
  }

  // Renders the reusable right-side auth visuals so login/register only configure a variant.
  function renderAuthVisual(variant) {
    if (variant === "transactions") {
      return `
        <div class="absolute inset-0 opacity-40">
          <div class="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-primary-fixed blur-[120px] rounded-full animated-orb"></div>
          <div class="absolute bottom-[-5%] left-[-5%] w-[500px] h-[500px] bg-secondary-container blur-[100px] rounded-full animated-orb animated-orb-delay"></div>
        </div>
        <div class="relative w-full h-full flex flex-col justify-center items-center p-gutter md:p-16">
          <div class="relative w-full max-w-[560px]">
            <div class="glass-card rounded-xl p-7 soft-glow floating-card">
              <div class="flex items-start justify-between gap-6 mb-7">
                <div>
                  <span class="font-label-caps text-label-caps text-secondary">RECENT TRANSACTIONS</span>
                  <h2 class="font-h1 text-h1 text-primary mt-2">Automatically categorized</h2>
                  <p class="font-body-sm text-body-sm text-secondary mt-2 max-w-sm">
                    Saver turns messy SMS and UPI history into a calm money feed from day one.
                  </p>
                </div>
                <div class="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-white shrink-0">
                  <span class="material-symbols-outlined">auto_awesome</span>
                </div>
              </div>
              <div class="space-y-4">
                ${renderTransactionRows({
                  amountKey: "amountCompact",
                  rowClass:
                    "flex items-center justify-between gap-4 bg-white/80 rounded-lg p-4 border border-white/70",
                  iconSizeClass: "text-xl",
                  titleClass: "font-h3 text-body-md font-bold text-on-surface",
                  amountClass: "font-h3 text-body-md font-bold text-on-surface",
                  timeClass: "font-body-sm text-[12px] text-secondary",
                  badgeClass: "px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide",
                })}
              </div>
            </div>
            <div class="absolute -bottom-8 -right-8 glass-card rounded-lg p-5 w-64 soft-glow floating-card floating-card-delay">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-white">
                  <span class="material-symbols-outlined text-[20px]">shield</span>
                </div>
                <div>
                  <p class="font-h3 text-body-md font-bold text-on-surface">Ready for setup</p>
                  <p class="font-body-sm text-[12px] text-secondary">Verify once, then personalize money mode.</p>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-16 text-center max-w-sm hidden md:block">
            <p class="font-body-lg text-body-md text-primary-container/80 italic font-medium">
              "First we organize your money history, then we help you build better habits."
            </p>
          </div>
        </div>
        <div class="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>
      `;
    }

    return `
      <div class="absolute inset-0 opacity-40">
        <div class="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-primary-fixed blur-[120px] rounded-full animated-orb"></div>
        <div class="absolute bottom-[-5%] left-[-5%] w-[500px] h-[500px] bg-secondary-container blur-[100px] rounded-full animated-orb animated-orb-delay"></div>
      </div>
      <div class="relative w-full h-full flex flex-col justify-center items-center p-gutter md:p-16">
        <div class="relative w-full max-w-lg aspect-square">
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="relative w-72 h-72 md:w-96 md:h-96 rounded-full flex items-center justify-center bg-white/30 backdrop-blur-md soft-glow animated-ring">
              <div class="savings-ring w-[85%] h-[85%] rounded-full opacity-90"></div>
              <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span class="font-label-caps text-label-caps text-secondary mb-1">Total Goal Progress</span>
                <span class="font-display text-[42px] md:text-[56px] font-bold text-primary-container tracking-tighter">75%</span>
                <span class="font-body-sm text-body-sm text-on-primary-container font-medium mt-1">+&#8377;1,240 this month</span>
              </div>
            </div>
          </div>
          <div class="absolute top-10 -left-4 md:-left-12 glass-card rounded-lg p-6 w-56 md:w-64 soft-glow floating-card">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-white">
                <span class="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              </div>
              <div>
                <h3 class="font-h3 text-body-md font-bold text-on-surface">Safe-to-Spend</h3>
                <p class="font-body-sm text-[12px] text-secondary">Updated 2m ago</p>
              </div>
            </div>
            <div class="space-y-1">
              <span class="block font-display text-h2 font-bold text-primary-container">&#8377;4,820</span>
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-[#86af99]"></span>
                <span class="text-[12px] font-medium text-secondary">Optimal budget</span>
              </div>
            </div>
          </div>
          <div class="absolute bottom-12 -right-4 md:-right-8 glass-card rounded-lg p-6 w-64 md:w-72 soft-glow floating-card floating-card-delay">
            <div class="flex justify-between items-center mb-6">
              <span class="font-label-caps text-label-caps text-secondary">Savings Buckets</span>
              <span class="material-symbols-outlined text-outline-variant text-[18px]">more_horiz</span>
            </div>
            <div class="space-y-4">
              <div class="space-y-2">
                <div class="flex justify-between text-body-sm">
                  <span class="text-on-surface font-medium">Home Deposit</span>
                  <span class="text-secondary">&#8377;12.5k</span>
                </div>
                <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <div class="h-full bg-primary-container w-[65%] rounded-full"></div>
                </div>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between text-body-sm">
                  <span class="text-on-surface font-medium">Travel 2025</span>
                  <span class="text-secondary">&#8377;4.2k</span>
                </div>
                <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <div class="h-full bg-primary-container w-[40%] rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-16 text-center max-w-sm hidden md:block">
          <p class="font-body-lg text-body-md text-primary-container/80 italic font-medium">
            "Finally, a space where my wealth feels organized and my mind feels at ease."
          </p>
        </div>
      </div>
      <div class="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>
    `;
  }

  // Renders the shared login/register shell while leaving the actual form fields page-specific.
  function renderAuthShell(container) {
    const variantKey = container.dataset.authVariant || "login";
    const variant = authShellVariants[variantKey] || authShellVariants.login;
    const formTemplate = container.querySelector("[data-auth-form-template]");
    if (!formTemplate) return;

    const brandHref = container.dataset.brandHref || "index.html";
    const eyebrow = container.dataset.eyebrow || "";
    const title = container.dataset.title || "";
    const description = container.dataset.description || "";
    const alternatePrompt = container.dataset.alternatePrompt || "";
    const alternateHref = container.dataset.alternateHref || "index.html";
    const alternateLabel = container.dataset.alternateLabel || "";
    const visualVariant = container.dataset.visualVariant || variant.visual;

    container.outerHTML = `
      <main class="flex min-h-screen md:h-screen w-full overflow-hidden">
        <section class="auth-panel w-full min-w-0 flex-1 flex flex-col justify-center items-center ${variant.panelPadding} bg-surface min-h-screen md:min-h-0 md:h-screen overflow-y-auto md:overflow-hidden">
          <div class="auth-form-content w-full max-w-[440px] ${variant.contentSpacing}">
            <div class="${variant.brandWrapperClass}">
              <a class="font-display text-h2 font-bold tracking-tighter text-primary-container" href="${escapeHtml(brandHref)}">Saver</a>
            </div>
            <div class="${variant.headingSpacing}">
              <span class="inline-block px-4 py-1.5 rounded-full bg-secondary-container text-primary-container font-label-caps text-label-caps">
                ${escapeHtml(eyebrow)}
              </span>
              <h1 class="${variant.titleClass}">${escapeHtml(title)}</h1>
              <p class="${variant.descriptionClass}">${escapeHtml(description)}</p>
            </div>
            ${formTemplate.innerHTML.trim()}
            <div class="relative flex items-center ${variant.dividerPadding}">
              <div class="flex-grow border-t border-surface-container-highest"></div>
              <span class="flex-shrink mx-4 font-label-caps text-label-caps text-outline-variant">OR</span>
              <div class="flex-grow border-t border-surface-container-highest"></div>
            </div>
            ${renderGoogleButton(variant.googleButtonPadding)}
            <p class="text-center font-body-md text-body-md text-secondary ${variant.alternatePadding}">
              ${escapeHtml(alternatePrompt)}
              <a class="text-primary-container font-bold hover:underline" href="${escapeHtml(alternateHref)}">${escapeHtml(alternateLabel)}</a>
            </p>
          </div>
        </section>
        <section class="hidden md:block md:w-1/2 lg:w-[55%] relative overflow-hidden bg-[#F1EFE9] md:min-h-screen md:h-screen">
          ${renderAuthVisual(visualVariant)}
        </section>
      </main>
    `;
  }

  // Mounts every declared shared component on the page.
  function mountComponents() {
    document.querySelectorAll('[data-component="marketing-header"]').forEach(renderMarketingHeader);
    document.querySelectorAll('[data-component="marketing-footer"]').forEach(renderMarketingFooter);
    document.querySelectorAll('[data-component="app-header"]').forEach(renderAppHeader);
    document.querySelectorAll('[data-component="transaction-feed"]').forEach(renderLandingTransactionFeed);
    document.querySelectorAll("[data-auth-shell]").forEach(renderAuthShell);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountComponents, { once: true });
  } else {
    mountComponents();
  }
})();
