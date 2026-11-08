// Minden oldalon közös viselkedés: horgony-görgetés, "vissza a tetejére" gomb, mobil menü.
function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const hash = anchor.getAttribute('href');
      const target = document.getElementById(hash.slice(1));
      if (!target) return;

      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.pageYOffset - 10;
      window.scrollTo({ top: y, behavior: 'smooth' });
      history.replaceState(null, '', hash);
    });
  });
}

function initScrollTop() {
  const scrollBtn = document.getElementById('scrollTopBtn');
  if (!scrollBtn) return;

  window.addEventListener('scroll', () => {
    scrollBtn.classList.toggle('show', window.scrollY > 200);
  }, { passive: true });
  scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function initMobileMenu() {
  const burger = document.querySelector('.vegburger');
  const mobileMenu = document.querySelector('#mobile-menu');
  const backdrop = document.querySelector('.menu-backdrop');
  if (!burger || !mobileMenu || !backdrop) return;

  const setOpen = (open) => {
    mobileMenu.classList.toggle('open', open);
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    backdrop.classList.toggle('show', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };

  burger.addEventListener('click', () => setOpen(!mobileMenu.classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => { if (window.innerWidth <= 768) setOpen(false); });
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 768) setOpen(false); });
}

function init() {
  initSmoothAnchors();
  initScrollTop();
  initMobileMenu();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
