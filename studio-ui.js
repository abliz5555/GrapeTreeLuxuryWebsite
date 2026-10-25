/* Studio layout helper: start-tiles, toolbar buttons. Pure UI; the studio engine does the work. */
(function(){
  function $(s,r){return (r||document).querySelector(s);}
  function all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function init(){
    var tiles=$('#st-tiles'); if(!tiles) return;
    function show(name){
      all('.st-tile',tiles).forEach(function(t){var on=t.getAttribute('data-pane')===name;t.classList.toggle('on',on);t.setAttribute('aria-selected',on?'true':'false');});
      all('.st-pane').forEach(function(p){p.hidden=p.getAttribute('data-pane')!==name;});
      var box=$('#st-aidraw'), op=$('#st-aidraw-open');
      if(name==='ai'){ if(box&&box.hidden&&op) op.click(); }
      else if(box&&!box.hidden&&op){ op.click(); }
    }
    tiles.addEventListener('click',function(e){var t=e.target.closest('.st-tile'); if(t) show(t.getAttribute('data-pane'));});
    var cr=$('#st-create'); var pane=$('.st-pane[data-pane="build"]');
    var d=$('#st-decor-btn'), d0=$('#st-decor');
    if(d&&d0) d.addEventListener('click',function(){d0.click();});
    function moveRights(){var r=$('#st-rights'),pn=$('.st-pane[data-pane="upload"]');if(r&&pn&&r.nextElementSibling!==pn&&r.parentNode!==pn){tiles.parentNode.insertBefore(r,tiles.nextSibling);}}
    moveRights();setTimeout(moveRights,0);window.addEventListener('load',moveRights);
    var m=$('.st-menu'); if(m) document.addEventListener('click',function(e){if(m.open&&!m.contains(e.target)) m.open=false;});
    if(m) m.addEventListener('click',function(e){if(e.target.closest('.st-menu-box button')) m.open=false;});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
