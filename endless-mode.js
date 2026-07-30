(()=>{
  "use strict";

  const CFG_KEY="ppb_admin_config_v1";
  const STORE_KEY="ppb_premium_state_v2";
  const BASE_KEY="ppb_endless_difficulty_base_v1";
  const DEFAULT_ICONS=[
    {id:"tomato",name:"Томат",kind:"emoji",value:"🍅"},
    {id:"broccoli",name:"Брокколи",kind:"emoji",value:"🥦"},
    {id:"egg",name:"Яйцо",kind:"emoji",value:"🍳"},
    {id:"chicken",name:"Курица",kind:"emoji",value:"🍗"},
    {id:"lettuce",name:"Салат",kind:"emoji",value:"🥬"},
    {id:"rice",name:"Рис",kind:"emoji",value:"🍚"},
    {id:"avocado",name:"Авокадо",kind:"emoji",value:"🥑"},
    {id:"cucumber",name:"Огурец",kind:"emoji",value:"🥒"}
  ];

  function read(key,fallback=null){
    try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}
  }

  let savedState=read(STORE_KEY,null);
  if(!savedState){
    savedState={level:1};
    localStorage.setItem(STORE_KEY,JSON.stringify(savedState));
  }
  const level=Math.max(1,Number(savedState.level)||1);

  const storedCfg=read(CFG_KEY,null);
  const hasAdminCfg=Boolean(storedCfg?.season&&Array.isArray(storedCfg.icons)&&storedCfg.icons.length>=6);
  const originalCfg=hasAdminCfg?structuredClone(storedCfg):null;
  const cfg=hasAdminCfg?structuredClone(storedCfg):{
    season:{name:"PP Challenge",subtitle:"Бесконечный сезон PP Balance",target:48560,moves:22,active:true},
    prizes:[],
    icons:DEFAULT_ICONS
  };

  const currentTarget=Math.max(6500,Number(cfg.season.target)||48560);
  const currentMoves=Math.max(16,Number(cfg.season.moves)||22);
  let base=read(BASE_KEY,null);

  if(!base||Number(base.target)!==currentTarget||Number(base.moves)!==currentMoves){
    base={target:currentTarget,moves:currentMoves};
    localStorage.setItem(BASE_KEY,JSON.stringify(base));
  }

  // Каждый следующий уровень строго сложнее предыдущего:
  // цель по очкам растёт на каждом уровне, а число ходов постепенно уменьшается.
  const scoreMultiplier=1+0.12*Math.log2(level)+0.0015*(level-1);
  cfg.season.target=Math.round(base.target*scoreMultiplier);
  cfg.season.moves=Math.max(16,base.moves-Math.floor((level-1)/12));
  cfg.season.subtitle=`Бесконечный сезон · уровень ${level}`;
  localStorage.setItem(CFG_KEY,JSON.stringify(cfg));

  document.addEventListener("DOMContentLoaded",()=>{
    // После загрузки движка возвращаем исходную конфигурацию, чтобы админка
    // показывала базовые значения. Для игроков без настроек временный конфиг удаляется.
    if(hasAdminCfg)localStorage.setItem(CFG_KEY,JSON.stringify(originalCfg));
    else localStorage.removeItem(CFG_KEY);

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
