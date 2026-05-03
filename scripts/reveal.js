/**
 * FOUC Prevention — Reveal page after fonts and styles are loaded.
 * Works with the body:not(.is-ready) { opacity: 0 } rule in design-system.css.
 *
 * Waits for:
 *  1. Document readyState to be 'complete' (all resources loaded), OR
 *  2. A 1.5s timeout (failsafe so page never stays invisible)
 */
(function () {
  function reveal() {
    document.body.classList.add("is-ready");
  }

  if (document.readyState === "complete") {
    reveal();
  } else {
    window.addEventListener("load", reveal);
    // Failsafe: never stay invisible longer than 1.5s
    setTimeout(reveal, 1500);
  }
})();
