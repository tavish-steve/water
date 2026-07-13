// Dynamic year
document.getElementById("currentYear").textContent = new Date().getFullYear();

// ---- AD CAMPAIGN TRACKING ----
// Fires a GA4 + Meta Pixel conversion event. Safe to call even if the
// tracking scripts haven't loaded yet (e.g. ad blockers) — it just no-ops.
function trackConversion(eventName) {
  try {
    if (typeof gtag === "function") {
      gtag("event", eventName, { event_category: "lead_generation" });
    }
    if (typeof fbq === "function") {
      fbq("trackCustom", eventName);
    }
  } catch (e) {
    /* tracking should never break the page */
  }
}
window.trackConversion = trackConversion;

// Capture UTM parameters from the URL (set by ad campaigns) into the
// contact form's hidden fields, so enquiries arrive with their source.
(function captureUTMs() {
  const params = new URLSearchParams(location.search);
  const map = {
    utm_source: "utmSource",
    utm_medium: "utmMedium",
    utm_campaign: "utmCampaign",
  };
  Object.entries(map).forEach(([param, fieldId]) => {
    const field = document.getElementById(fieldId);
    if (field && params.get(param)) field.value = params.get(param);
  });
})();

// Fade-in on scroll
function initRevealAnimations() {
  const revealElements = document.querySelectorAll(".fade-in");
  if (!revealElements.length) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            currentObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    revealElements.forEach((el) => observer.observe(el));
    window.setTimeout(() => {
      revealElements.forEach((el) => el.classList.add("visible"));
    }, 140);
  } else {
    revealElements.forEach((el) => el.classList.add("visible"));
  }
}

initRevealAnimations();

// Nav scroll state
const nav = document.getElementById("nav");
const progress = document.getElementById("scrollProgress");
const backToTop = document.getElementById("backToTop");

let docHeight = document.documentElement.scrollHeight - window.innerHeight;
let ticking = false;

function updateScroll() {
  const y = window.scrollY;
  nav.classList.toggle("scrolled", y > 40);
  backToTop.classList.toggle("visible", y > 500);

  const pct = docHeight > 0 ? (y / docHeight) * 100 : 0;
  progress.style.width = pct + "%";
  ticking = false;
}

function onScroll() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(updateScroll);
  }
}
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", () => {
  docHeight = document.documentElement.scrollHeight - window.innerHeight;
  updateScroll();
});
updateScroll();

// Mobile menu
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

function closeMenu() {
  navLinks.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
}
navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", open ? "true" : "false");
});
navLinks.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", closeMenu),
);

// Scroll-spy active nav link
const sections = document.querySelectorAll("section[id]");
const navAnchors = navLinks.querySelectorAll("a");

const spy = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        navAnchors.forEach((a) => {
          a.classList.toggle("active", a.getAttribute("href") === "#" + id);
        });
      }
    });
  },
  { rootMargin: "-45% 0px -50% 0px" },
);
sections.forEach((s) => spy.observe(s));

// Back to top
backToTop.addEventListener("click", () =>
  window.scrollTo({ top: 0, behavior: "smooth" }),
);

// ---- CONTACT FORM: validation + EmailJS submission ----
const contactForm = document.getElementById("contactForm");
const formSuccess = document.getElementById("formSuccess");
const formErrorBanner = document.getElementById("formErrorBanner");
const submitBtn = document.getElementById("formSubmitBtn");

const EMAILJS_PUBLIC_KEY = "1YVnOTSHdKB9ob5cK";
const EMAILJS_SERVICE_ID = "service_kyjcwhb";
const EMAILJS_TEMPLATE_ID = "template_jicbvsd";

function initEmailJS() {
  if (typeof window.emailjs === "undefined") return;
  try {
    window.emailjs.init(EMAILJS_PUBLIC_KEY);
  } catch (error) {
    console.warn("EmailJS could not be initialized:", error);
  }
}

initEmailJS();

// If the browser lands here after a plain (no-JS) form POST, FormSubmit
// redirects back with ?sent=1 — show the success state the same way.
const sentParam = new URLSearchParams(location.search).get("sent");
if (sentParam === "1" && contactForm && formSuccess) {
  contactForm.style.display = "none";
  formSuccess.classList.add("visible");
  trackConversion("form_submit_success");
  history.replaceState(null, "", location.pathname);
}

if (contactForm && submitBtn) {
  const submitLabel = submitBtn.querySelector(".form-submit-label");

  const validators = {
    fullName: (v) => (v.trim().length >= 2 ? "" : "Please enter your full name."),
    phone: (v) => {
      const value = v.trim();
      if (!value) return "Please enter your phone number.";
      const normalized = value.replace(/[\s()-]/g, "");
      const isValid = /^(\+\d{1,3})?\d{7,15}$/.test(normalized) && normalized.length >= 7;
      return isValid
        ? ""
        : "Enter a valid phone number, including country code if needed.",
    },
    email: (v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Enter a valid email address.",
  };

  function showFieldError(field, message) {
    const errorEl = contactForm.querySelector(`[data-error-for="${field}"]`);
    const input = contactForm.querySelector(`#${field}`);
    if (errorEl) errorEl.textContent = message;
    if (input) input.classList.toggle("invalid", !!message);
  }

  function validateForm() {
    let firstInvalid = null;
    Object.entries(validators).forEach(([field, validate]) => {
      const input = contactForm.querySelector(`#${field}`);
      if (!input) return;
      const message = validate(input.value);
      showFieldError(field, message);
      if (message && !firstInvalid) firstInvalid = input;
    });
    return firstInvalid;
  }

  // Validate a field as soon as the user leaves it, and clear the error
  // as soon as they start correcting it.
  Object.keys(validators).forEach((field) => {
    const input = contactForm.querySelector(`#${field}`);
    if (!input) return;
    input.addEventListener("blur", () => showFieldError(field, validators[field](input.value)));
    input.addEventListener("input", () => {
      if (input.classList.contains("invalid")) showFieldError(field, validators[field](input.value));
    });
  });

  let isSubmitting = false;

  async function handleFormSubmission(event) {
    if (event) event.preventDefault();
    formErrorBanner.classList.remove("visible");

    const honey = contactForm.querySelector('[name="_honey"]');
    if (honey && honey.value) {
      contactForm.reset();
      contactForm.style.display = "none";
      formSuccess.classList.add("visible");
      return;
    }

    const firstInvalid = validateForm();
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    if (isSubmitting) return;

    isSubmitting = true;
    submitBtn.disabled = true;
    if (submitLabel) submitLabel.textContent = "Sending…";

    const fullName = contactForm.querySelector("#fullName").value.trim();
    const phone = contactForm.querySelector("#phone").value.trim();
    const email = contactForm.querySelector("#email").value.trim();
    const projectType = contactForm.querySelector("#projectType").value || "Not specified";
    const projectDetails = contactForm.querySelector("#projectDetails").value.trim();

    const templateParams = {
      from_name: fullName,
      reply_to: email,
      phone,
      project_type: projectType,
      project_details: projectDetails,
      message: `Name: ${fullName}\nPhone: ${phone}\nEmail: ${email}\nProject Type: ${projectType}\n\nProject Details:\n${projectDetails}`,
    };

    const isConfigured =
      EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY" &&
      EMAILJS_SERVICE_ID !== "YOUR_SERVICE_ID" &&
      EMAILJS_TEMPLATE_ID !== "YOUR_TEMPLATE_ID";

    if (!isConfigured) {
      formErrorBanner.classList.add("visible");
      submitBtn.disabled = false;
      if (submitLabel) submitLabel.textContent = "Send Enquiry →";
      isSubmitting = false;
      trackConversion("form_submit_error");
      return;
    }

    try {
      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      contactForm.reset();
      contactForm.style.display = "none";
      formSuccess.classList.add("visible");
      trackConversion("form_submit_success");
    } catch (error) {
      formErrorBanner.classList.add("visible");
      submitBtn.disabled = false;
      if (submitLabel) submitLabel.textContent = "Send Enquiry →";
      if (formSuccess) formSuccess.classList.remove("visible");
      trackConversion("form_submit_error");
      console.error("EmailJS submission failed:", error);
    } finally {
      isSubmitting = false;
    }
  }

  contactForm.addEventListener("submit", (e) => handleFormSubmission(e));
  submitBtn.addEventListener("click", (e) => handleFormSubmission(e));
}

