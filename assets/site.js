/* ============================================================
   Esmée Peets — shared site behaviour
   Cursor, page-transition curtain, scroll reveals, header state,
   mobile menu, gallery filters, lightbox.
   ============================================================ */
(function(){
  "use strict";

  /* ---------- entrance curtain (runs immediately on every page load) ---------- */
  document.documentElement.classList.add('js-ready');
  var curtain = document.querySelector('.curtain');
  if (curtain){
    document.body.classList.add('is-loading');
    curtain.classList.add('entering');
    window.addEventListener('DOMContentLoaded', function(){
      requestAnimationFrame(function(){
        curtain.classList.add('entering');
        setTimeout(function(){
          document.body.classList.remove('is-loading');
        }, 650);
      });
    });
  }

  /* ---------- exit curtain on internal navigation ---------- */
  document.addEventListener('click', function(e){
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var isInternal = a.host === window.location.host && href && !href.startsWith('#') && a.target !== '_blank';
    if (!isInternal) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (curtain){
      curtain.classList.remove('entering');
      curtain.classList.add('leaving');
      setTimeout(function(){ window.location.href = href; }, 480);
    } else {
      window.location.href = href;
    }
  });

  /* ---------- custom cursor ---------- */
  var dot = document.querySelector('.cursor-dot');
  var ring = document.querySelector('.cursor-ring');
  if (dot && ring && matchMedia('(hover:hover) and (pointer:fine)').matches){
    var mx=0, my=0, rx=0, ry=0;
    window.addEventListener('mousemove', function(e){
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate('+mx+'px,'+my+'px) translate(-50%,-50%)';
    });
    (function loop(){
      rx += (mx-rx)*0.16; ry += (my-ry)*0.16;
      ring.style.transform = 'translate('+rx+'px,'+ry+'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll('a, button, [data-cursor]').forEach(function(el){
      el.addEventListener('mouseenter', function(){
        ring.classList.add('is-active');
        ring.setAttribute('data-label', el.getAttribute('data-cursor') || 'View');
      });
      el.addEventListener('mouseleave', function(){
        ring.classList.remove('is-active');
      });
    });
  }

  /* ---------- header scroll state ---------- */
  var header = document.querySelector('.site-header');
  if (header){
    var onScroll = function(){
      header.classList.toggle('is-scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- mobile menu ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav){
    toggle.addEventListener('click', function(){
      nav.classList.toggle('is-open');
    });
    nav.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ nav.classList.remove('is-open'); });
    });
  }

  /* ---------- scroll reveals ---------- */
  var revealEls = document.querySelectorAll('[data-reveal], [data-reveal-stagger]');
  if ('IntersectionObserver' in window && revealEls.length){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('is-visible'); });
  }

  /* ---------- gallery filters ---------- */
  var filterBtns = document.querySelectorAll('.filter-btn');
  var galleryItems = document.querySelectorAll('.gallery-item');
  if (filterBtns.length && galleryItems.length){
    filterBtns.forEach(function(btn){
      btn.addEventListener('click', function(){
        filterBtns.forEach(function(b){ b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var f = btn.getAttribute('data-filter');
        galleryItems.forEach(function(item){
          var match = f === 'all' || item.getAttribute('data-category') === f;
          item.classList.toggle('is-hidden', !match);
        });
      });
    });
  }

  /* ---------- lightbox ---------- */
  var lightbox = document.querySelector('.lightbox');
  if (lightbox && galleryItems.length){
    var lbArt = lightbox.querySelector('.art-placeholder, .art-photo');
    var lbImg = lbArt ? lbArt.querySelector('img') : null;
    var lbTitle = lightbox.querySelector('.lightbox-info h3');
    var lbMeta = lightbox.querySelector('.work-meta');
    var lbDesc = lightbox.querySelector('.lightbox-info p');
    var items = Array.prototype.slice.call(galleryItems);
    var current = 0;

    function paint(i){
      current = (i + items.length) % items.length;
      var item = items[current];
      var art = item.querySelector('.art-placeholder, .art-photo');
      if (lbImg && art){
        var srcImg = art.querySelector('img');
        if (srcImg){
          lbImg.src = srcImg.src;
          lbImg.alt = srcImg.alt || '';
        } else {
          lbArt.className = 'art-placeholder ' + Array.prototype.slice.call(art.classList).filter(function(c){return c.indexOf('ph-')===0;}).join(' ');
        }
      }
      lbTitle.textContent = item.getAttribute('data-title') || '';
      lbMeta.textContent = item.getAttribute('data-meta') || '';
      lbDesc.textContent = item.getAttribute('data-desc') || '';
    }
    function open(i){ paint(i); lightbox.classList.add('is-open'); document.body.style.overflow='hidden'; }
    function close(){ lightbox.classList.remove('is-open'); document.body.style.overflow=''; }

    items.forEach(function(item, i){
      item.addEventListener('click', function(){ open(i); });
    });
    lightbox.querySelector('.lightbox-close').addEventListener('click', close);
    lightbox.addEventListener('click', function(e){ if (e.target === lightbox) close(); });
    lightbox.querySelector('.lightbox-prev').addEventListener('click', function(){ paint(current-1); });
    lightbox.querySelector('.lightbox-next').addEventListener('click', function(){ paint(current+1); });
    window.addEventListener('keydown', function(e){
      if (!lightbox.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') paint(current-1);
      if (e.key === 'ArrowRight') paint(current+1);
    });
  }

})();
