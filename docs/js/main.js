'use strict';
const menu = document.getElementById('menu-toggle');
const links = document.getElementById('nav-links');
function closeMenu(returnFocus = false) {
  const wasOpen = menu.getAttribute('aria-expanded') === 'true';
  links.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', '打开导航菜单');
  if (returnFocus && wasOpen) menu.focus();
}
menu.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
});
links.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu()));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenu(true);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.nav')) closeMenu();
});
const wideScreen = matchMedia('(min-width: 768px)');
wideScreen.addEventListener('change', event => { if (event.matches) closeMenu(); });
document.getElementById('copy-url').addEventListener('click', async () => {
  const status = document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText('chrome://extensions');
    status.textContent = '已复制，粘贴到 Chrome 地址栏即可。';
  } catch {
    status.textContent = '自动复制不可用，请手动复制上面的地址。';
  }
});
if ('IntersectionObserver' in window) {
  const inView = new Map();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) inView.set(entry.target.id, entry.intersectionRatio);
      else inView.delete(entry.target.id);
    }
    const activeSection = [...inView].sort((a, b) => b[1] - a[1])[0]?.[0];
    links.querySelectorAll('a[href^="#"]').forEach(link => {
      const active = Boolean(activeSection) && link.getAttribute('href') === '#' + activeSection;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-12% 0px -55% 0px', threshold: [0, 0.2, 0.5] });
  document.querySelectorAll('section[id]').forEach(section => observer.observe(section));
}
