(()=>{
  "use strict";

  const CFG_KEY="ppb_admin_config_v1";
  const STORE_KEY="ppb_premium_state_v2";
  const BASE_KEY="ppb_endless_difficulty_base_v1";

  function read(key,fallback=null){
    try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}
  }

  const state=read(STORE_KEY,{level:1});
  const level=Math.max(1,Number(state?.level)||1);
  const cfg=read(CFG_KEY,null);
  let originalCfg=null;

  if(cfg?.season){
    const currentTarget=Math.max(6500,Number(cfg.season.target)||48560);
    const currentMoves=Math.max(16,Number(cfg.season.moves)||22);
    let base=read(BASE_KEY,null);

    if(!base||Number(base.target)!==currentTarget||Number(base.moves)!==currentMoves){
      base={target:currentTarget,moves:currentMoves};
      localStorage.setItem(BASE_KEY,JSON.stringify(base));
    }

    originalCfg=structuredClone(cfg);

    // Каждый следующий уровень строго сложнее предыдущего:
    // цель по очкам растёт непрерывно, а количество ходов постепенно сокращается.
    const scoreMultiplier=1+0.12*Math.log2(level)+0.0015*(level-1);
    cfg.season.target=Math.round(base.target*scoreMultiplier);
    cfg.season.moves=Math.max(16,base.moves-Math.floor((level-1)/12));
    localStorage.setItem(CFG_KEY,JSON.stringify(cfg));
  }

  document.addEventListener("DOMContentLoaded",()=>{
    // Возвращаем базовые настройки в storage, чтобы админка продолжала показывать
    // заданные администратором значения, а не вычисленную сложность уровня.
    if(originalCfg)localStorage.setItem(CFG_KEY,JSON.stringify(originalCfg));

    const map=document.getElementById("map");
    if(map){
      map.style.display="none";
      map.setAttribute("aria-hidden","true");
    }

    const mapNav=document.querySelector('.bottom-nav button[data-screen="map"]');
    if(mapNav){
      mapNav.dataset.screen="game";
      mapNav.innerHTML="<span>🎮</span>Игра";
    }

    const play=document.getElementById("playCurrent");
    if(play)play.click();

    document.querySelectorAll(".bottom-nav button").forEach(btn=>{
      btn.classList.toggle("active",btn.dataset.screen==="game");
    });

    const gameMessage=document.getElementById("gameMessage");
    if(gameMessage)gameMessage.textContent=`Бесконечный сезон · уровень ${level}`;

    const resultKicker=document.querySelector("#winModal .modal-card > div:nth-of-type(2)");
    if(resultKicker)resultKicker.textContent=`УРОВЕНЬ ${level} ПРОЙДЕН`;

    const nextBtn=document.getElementById("nextLevelBtn");
    if(nextBtn){
      nextBtn.textContent=`Уровень ${level+1}`;
      nextBtn.onclick=()=>{
        document.getElementById("winModal")?.classList.remove("open");
        location.reload();
      };
    }

    for(const id of["mapAfterWin","mapAfterLose"]){
      const el=document.getElementById(id);
      if(el)el.style.display="none";
    }

    const winActions=document.querySelector("#winModal .modal-actions");
    const loseActions=document.querySelector("#loseModal .modal-actions");
    if(winActions)winActions.style.gridTemplateColumns="1fr";
    if(loseActions)loseActions.style.gridTemplateColumns="1fr";
  });
})();
