/* Vinkelner v5 – grensesnitt. Tekstforståelse og rangering ligger i engine.js. */
(function(){
"use strict";
const {parse,recommend,hash,typeWord,budgetWord}=window.VKE;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
let favs=store.get("vk_favs",[]);
let profile=store.get("vk_profile",null);
let lastQuery="", shown=[], round=0, lastP=null, lastEmpty=false;

const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ic=(n,cls="")=>`<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const wineById=id=>WINES.find(w=>w.id===id);
const bodyL=b=>b<=1?"Lett":b<=2?"Lett til medium":b==3?"Medium":b==4?"Fyldig":"Kraftig";
const sweetL=s=>s<=1?"Tørr":s==2?"Halvtørr":s==3?"Medium søt":"Søt";
const gav=(m,c="")=>`<span class="gav ${c}">${gustav(m)}</span>`;
const wait=ms=>new Promise(r=>setTimeout(r,reduce?Math.min(ms,30):ms));

/* ---------- Flaskesilhuett: én rolig form, vintypen vises som dempet tone ---------- */
function bottle(w){
  const t=w.type,sp=t==="S";
  const body=sp?"M14 8h12v24c0 9 12 13 12 30v48a7 7 0 0 1-7 7H9a7 7 0 0 1-7-7V62c0-17 12-21 12-30z":"M16 8h8v24c0 10 11 14 11 30v48a7 7 0 0 1-7 7H12a7 7 0 0 1-7-7V62c0-16 11-20 11-30z";
  const x0=sp?2:5,wd=sp?36:30;
  return `<svg class="bottle" viewBox="0 0 40 120" aria-hidden="true" focusable="false">
    <path d="${body}" fill="var(--t-${t})"/>
    <rect x="${x0}" y="72" width="${wd}" height="30" fill="var(--label)"/>
    <rect x="${x0+6}" y="80" width="${wd-12}" height="2" fill="var(--ink)" opacity=".7"/>
    <rect x="${x0+9}" y="86" width="${wd-18}" height="1.500" fill="var(--ink)" opacity=".35"/>
    <rect x="${sp?13:15}" y="2" width="${sp?14:10}" height="10" rx="1.500" fill="var(--ink)"/>
  </svg>`;
}
const SPRIG="";
const tileVar=w=>`--tone:var(--t-${w.type})`;

/* ---------- Navigasjon ---------- */
let cur="home", stack=[];
function go(name,push=true){
  if(name===cur)return;
  const from=$("#screen-"+cur), to=$("#screen-"+name);
  if(push)stack.push(cur);
  from.classList.remove("active");from.setAttribute("aria-hidden","true");
  to.classList.add("active");to.removeAttribute("aria-hidden");
  cur=name;
  const sc=to.querySelector(".scroll");if(sc)sc.scrollTop=0;
}
function back(){const p=stack.pop()||"home";go(p,false)}
$$("[data-back]").forEach(b=>b.addEventListener("click",back));
$("#open-profile").addEventListener("click",()=>{renderProfile();go("profile")});
$("#open-favs").addEventListener("click",()=>{renderFavs();go("favs")});
$("#res-favs").addEventListener("click",()=>{renderFavs();go("favs")});
$("#open-scan").addEventListener("click",()=>go("scan"));
$("#home-g").innerHTML=gustav("hello");
$("#orb").addEventListener("click",()=>{go("ask");startAsk()});
$("#res-back").addEventListener("click",()=>{stack=["home"];go("ask",false);startAsk()});
function updateBadge(){
  const n=favs.length;
  [$("#fav-badge"),...$$("[data-badge]")].forEach(b=>{b.textContent=n;b.hidden=!n});
}

/* ---------- Samtalen v5: Gustav snakker, ett kort om gangen ---------- */
/* opts: [tekst, søketekst, ikon, Gustavs reaksjon, humør] */
const STEPS=[
 {say:"Hva står på menyen i kveld?",mood:"hello",ph:"Eller skriv: «grillet laks»",opts:[
   ["Fisk og skalldyr","fisk","fish","Havet og vin kommer overens. Det gjør ikke alle.","yum"],["Kjøtt","kjøtt","meat","Aha. Da trenger vi litt ryggrad.","surprised"],
   ["Pasta og pizza","pasta pizza","bowl","Italia. Gustav setter seg ned.","yum"],["Vegetar","vegetar","leaf","Grønt og vakkert. Gustav nikker anerkjennende.","wink"],
   ["Ost og tapas","ost tapas","cheese","Småplukk er den beste sosiale sporten.","wink"],["Bare vin, takk","","sparkle","Rent og ærlig. Respekt.","sly"]]},
 {say:"Og hva er anledningen?",mood:"hello",ph:"Eller fortell selv …",opts:[
   ["Vanlig hverdag","","plate","Hverdager fortjener også en god flaske.","wink"],["Middag med gjester","fest","flame","Da skal vi være litt flinke.","surprised"],
   ["Romantisk date","romantisk date","heart","Gustav ser ingenting. Gustav har ikke sett noe.","sly"],["Gave","gave","gift","Hvem er den heldige? Gustav tier som graven.","wink"],
   ["Feiring","feiring","sparkle","Skål, da. Vi tar frem boblene.","yum"]]},
 {say:"Hva vil du bruke på flasken?",mood:"thinking",ph:"Eller skriv: «rundt 250 kr»",budget:true}
];
const STOPS=[
 {v:100,cap:"Under",num:"100",part:"under 100 kr",say:"Sparegris-modus. Gustav respekterer det.",mood:"hello"},
 {v:150,cap:"Under",num:"150",part:"under 150 kr",say:"Fornuftig. Gustav nikker.",mood:"wink"},
 {v:200,cap:"Rundt",num:"200",part:"rundt 200 kr",say:"Gullkanten. Der bor de beste.",mood:"yum"},
 {v:300,cap:"Rundt",num:"300",part:"rundt 300 kr",say:"Litt kos, altså. Gustav liker deg.",mood:"sly"},
 {v:450,cap:"Rundt",num:"450",part:"rundt 450 kr",say:"Nå snakker vi.",mood:"surprised"},
 {v:0,cap:"Ingen grense",num:"Fritt",part:"",say:"Ingen grenser? Gustav må sette seg ned.",mood:"surprised"}
];
const DISH={
 laks:["Laks. Fet og fin. Da vil vi ha litt syre.","yum"],torsk:["Torsk. Skrei i hjertet, vin i glasset.","wink"],fisk:["Havet og vin kommer overens. Det gjør ikke alle.","yum"],
 skalldyr:["Skalldyr. Nå trenger vi noe friskt og stramt.","surprised"],sushi:["Sushi. Gustav bukker, og bart følger etter.","wink"],
 biff:["Biff. Her trenger vi ryggrad.","surprised"],"kjøtt":["Aha. Da trenger vi litt ryggrad.","surprised"],lam:["Lam. Gustav setter seg opp.","surprised"],
 vilt:["Vilt. Skogens dypeste hemmeligheter.","surprised"],gryte:["Gryte. Gustav kjenner lukten herfra.","yum"],svin:["Svin. Saftig, salt og snilt.","yum"],
 kylling:["Kylling, den mest tolerante av alle retter.","wink"],pasta:["Pasta. Gustav setter seg ned.","yum"],pizza:["Pizza. Gustav godkjenner, uten å si det høyt.","yum"],ost:["Ost. Småplukk er den beste sosiale sporten.","wink"],
 taco:["Taco. Fredag, er det deg?","yum"],dessert:["Dessert. Nå blir det sødme og stemning.","yum"],fest:["Fest. Gustav tar frem det fine glasset.","surprised"],
 grill:["Grill. Gustav lukter allerede kull.","yum"],tapas:["Tapas. Mange små gleder.","wink"],vegetar:["Grønt og vakkert. Gustav nikker anerkjennende.","wink"],
 asiatisk:["Asiatisk. Litt syre og kanskje litt søtt.","yum"],aperitiff:["Aperitiff. Gustav er allerede i sommerhumør.","wink"],sopp:["Sopp. Jord, smør og umami.","yum"]
};
const GENERIC=[["Spennende. Gustav noterer.","wink"],["Hm. Den kan Gustav jobbe med.","sly"],["Det høres godt ut.","yum"]];
let step=0, chatToken=0, busy=false, sayTk=0, dialIdx=2, dialTouched=false;
let known=null, hist=[];
function blankKnown(){return {dish:null,occasion:null,budget:null,type:null,mood:null,method:null,notes:[]}}
function cloneKnown(k){return {dish:k.dish,occasion:k.occasion,budget:k.budget,type:k.type,mood:k.mood,method:k.method,notes:k.notes.slice()}}
const filledCount=()=>(known.dish?1:0)+(known.occasion?1:0)+(known.budget?1:0);
function nextStep(){if(!known.dish)return 0;if(!known.occasion)return 1;if(!known.budget)return 2;return -1}
function mergeUnderstand(text){
  const u=window.VKE.understand(text);
  if(u.dish)known.dish=u.dish;
  if(u.occasion)known.occasion=u.occasion;
  if(u.budget)known.budget=u.budget;
  if(u.type)known.type=u.type;
  if(u.mood&&u.mood.length)known.mood=u.mood;
  if(u.method)known.method=u.method;
  if(text)known.notes.push(text);
  return u;
}
function occasionPhrase(o){
  const lab=o.label.toLowerCase();
  if(o.id==="hverdag")return lab==="hverdag"?"til hverdags":"på "+lab;
  return {svigers:"til svigers",date:"på date",feiring:"til feiringen",bursdag:"til bursdag",middag:"til selskapet",jul:"til jul",paske:"til påske",hytte:"på hytta",grill:"på grillen",fest:"til fest",gave:"i gave"}[o.id]||("til "+lab);
}
function understoodPhrase(u){
  const raw=(u.raw||"").toLowerCase();
  if(/forlov/.test(raw)&&!u.dish&&!u.budget&&!u.type)return "Forlovelse";
  const bits=[];
  if(u.dish){let d=u.dish.label.toLowerCase();if(u.method&&u.method.id==="grill")d="grillet "+d;bits.push(d)}
  if(u.type)bits.push(u.type.label.toLowerCase());
  if(u.mood&&u.mood.length)bits.push(u.mood.map(m=>m.label.toLowerCase()).join(" og "));
  let s=bits.join(", ");
  if(u.occasion)s=s?s+" "+occasionPhrase(u.occasion):u.occasion.label;
  if(u.budget&&!u.budget.any)s=s?s+", "+u.budget.label.toLowerCase():u.budget.label;
  return s?s.charAt(0).toUpperCase()+s.slice(1):"";
}
function acknowledge(u,done){
  const onlyDish=u.dish&&!u.occasion&&!u.budget&&!u.type&&!(u.mood&&u.mood.length);
  if(onlyDish&&DISH[u.dish.id])return DISH[u.dish.id];
  const phrase=understoodPhrase(u);
  if(!phrase)return GENERIC[hash(u.raw||"")%GENERIC.length];
  const raw=(u.raw||"").toLowerCase();
  let tail,mood;
  if(u.occasion&&u.occasion.id==="svigers"){tail="Gustav oppfører seg.";mood="wink"}
  else if(/forlov/.test(raw)){tail="Gratulerer. Gustav later som han ikke blir rørt.";mood="sly"}
  else if(u.occasion&&u.occasion.id==="feiring"){tail="Gustav tar frem det fine glasset.";mood="surprised"}
  else if(u.occasion&&u.occasion.id==="date"){tail="Gustav har ikke sett noe.";mood="sly"}
  else if(u.dish&&u.dish.id==="pizza"&&u.occasion&&u.occasion.id==="hverdag"){tail="Klassisk. Gustav nikker.";mood="yum"}
  else if(u.occasion&&u.occasion.id==="hverdag"){tail="Hverdager fortjener også en flaske.";mood="wink"}
  else if(u.budget&&u.budget.any&&done){tail="Prisen får være. Gustav finner ut av det.";mood="wink"}
  else if(done){tail="Da spør Gustav ikke mer.";mood="yum"}
  else if(u.dish){tail="Gustav noterer.";mood="yum"}
  else {tail="Notert.";mood="wink"}
  return [phrase+". "+tail,mood];
}
const DISH_CHIPS={
  "fisk":{id:"fisk",label:"Fisk",query:"fisk"},
  "kjøtt":{id:"kjøtt",label:"Kjøtt",query:"kjøtt"},
  "pasta pizza":{id:"pasta",label:"Pasta og pizza",query:"pasta pizza"},
  "vegetar":{id:"vegetar",label:"Vegetar",query:"vegetar"},
  "ost tapas":{id:"ost",label:"Ost og tapas",query:"ost tapas"},
  "":{id:"none",label:"",query:""}
};
const OCC_CHIPS={
  "":{id:"hverdag",label:"Hverdag",query:"hverdag"},
  "fest":{id:"middag",label:"Middagsselskap",query:"fest gjester middagsselskap"},
  "romantisk date":{id:"date",label:"Date",query:"romantisk date"},
  "gave":{id:"gave",label:"Gave",query:"gave"},
  "feiring":{id:"feiring",label:"Feiring",query:"feiring fest"}
};
function applyChoice(i,opt){
  if(i===0){
    known.dish=DISH_CHIPS[opt[1]]||{id:"annet",label:opt[0],query:opt[1]};
    if(known.dish.query)known.notes.push(known.dish.query);
  }else if(i===1){
    known.occasion=OCC_CHIPS[opt[1]]||{id:"annet",label:opt[0],query:opt[1]};
    if(known.occasion.query)known.notes.push(known.occasion.query);
  }
}
function searchText(){
  const parts=known.notes.filter(Boolean);
  if(known.budget&&known.budget.part)parts.push(known.budget.part);
  return parts.join(", ");
}
const askScr=$("#screen-ask"), body=$("#ask-body"), sayBox=$("#say"), sayT=$("#say-t");
const setMood=m=>{$("#ask-g").innerHTML=gustav(m)};
function hop(cls="hop"){const g=$("#ask-gus");g.classList.remove("hop","shake");void g.offsetWidth;if(!reduce)g.classList.add(cls)}
const poof=()=>{};
/* tekst skrives ut tegn for tegn; skjermleser får hele setningen én gang */
function sayText(text,react=false,instant=false){
  const tk=++sayTk;sayBox.classList.toggle("react",react);
  $("#say-live").textContent=text;
  return new Promise(res=>{
    if(reduce||instant){sayT.textContent=text;sayT.classList.remove("typing");return res()}
    sayT.textContent="";sayT.classList.add("typing");let i=0;
    const iv=setInterval(()=>{
      if(tk!==sayTk){clearInterval(iv);return res()}
      i+=1;sayT.textContent=text.slice(0,i);
      if(i>=text.length){clearInterval(iv);sayT.classList.remove("typing");res()}
    },Math.max(10,Math.min(18,620/text.length)));
  });
}
function setProgress(n){
  $$("#steps i").forEach((x,i)=>x.classList.toggle("on",i<n));
  $("#steps").setAttribute("aria-valuenow",n);
}
function setCloseIcon(){
  const back=hist.length>0;$("#ask-close").setAttribute("aria-label",back?"Tilbake":"Avbryt");
  $("#ask-close").innerHTML=`<svg class="ic"><use href="#i-${back?"back":"close"}"/></svg>`;
}
function swapCard(el,dir){
  const old=body.querySelector(".qcard:not(.out)");
  if(old){old.classList.add("out",dir==="prev"?"out-r":"out-l");setTimeout(()=>old.remove(),reduce?0:340)}
  el.classList.add("in",dir==="prev"?"in-l":"in-r");body.appendChild(el);
}
function chipsHTML(s){
  return `<div class="chips big">`+s.opts.map((o,i)=>{
    const last=i===s.opts.length-1&&s.opts.length%2===1;
    return `<button class="chip" type="button" data-i="${i}" style="--i:${i}"><span class="oi">${ic(o[2])}</span><span class="ct">${o[0]}</span><span class="chk">${ic("check")}</span></button>`;
  }).join("")+`</div>`;
}
function dialHTML(){
  const labs=STOPS.map((x,i)=>`<span>${x.v?x.v:"∞"}</span>`).join("");
  return `<div class="dial"><div class="dial-cap" id="dial-cap"></div><div class="dial-num" id="dial-num"></div>
    <div class="range-wrap"><input id="dial" type="range" min="0" max="${STOPS.length-1}" step="1" value="${dialIdx}" aria-label="Budsjett per flaske"></div>
    <div class="ticks" aria-hidden="true">${labs}</div>
    <button class="btn" id="dial-ok" type="button">Det passer</button>
    <button class="txt-btn" id="dial-any" type="button">Spiller ingen rolle</button></div>`;
}
function paintDial(quiet){
  const x=STOPS[dialIdx],d=$("#dial");
  $("#dial-cap").textContent=x.cap;
  $("#dial-num").innerHTML=x.v?`${x.num}<small>kr</small>`:x.num;
  d.style.setProperty("--p",(dialIdx/(STOPS.length-1)*100)+"%");
  d.setAttribute("aria-valuetext",x.v?`${x.cap.toLowerCase()} ${x.num} kroner`:"ingen grense");
  if(!quiet){const n=$("#dial-num");n.classList.remove("pop");void n.offsetWidth;n.classList.add("pop")}
}
async function showStep(i,dir="next"){
  const tk=chatToken,s=STEPS[i];step=i;busy=false;
  askScr.dataset.step=i;setProgress(filledCount());setCloseIcon();
  $("#q").placeholder=s.ph;
  const el=document.createElement("div");el.className="qcard";
  el.innerHTML=s.budget?dialHTML():chipsHTML(s);
  swapCard(el,dir);
  if(s.budget){dialTouched=false;paintDial(true)}
  setMood(s.mood);hop();
  await sayText(s.say,false);if(tk!==chatToken)return;
}
async function startAsk(){
  const tk=++chatToken;known=blankKnown();hist=[];busy=true;step=0;dialIdx=2;
  body.innerHTML="";$("#q").value="";$("#composer").classList.remove("has");
  askScr.dataset.step=0;setProgress(0);setCloseIcon();setMood("hello");
  await sayText("Hei. Gustav her.",false);hop("shake");
  await wait(520);if(tk!==chatToken)return;
  showStep(0);
}
async function react(text,mood){
  setMood(mood);hop();
  await sayText(text,true);
}
/* Går videre bare til spørsmål som fortsatt mangler. snap er tilstanden før siste svar. */
async function afterReact(tk,snap){
  await wait(reduce?40:720);if(tk!==chatToken)return;
  sayBox.classList.remove("react");
  const n=nextStep();
  setProgress(n===-1?3:filledCount());
  if(n===-1){run(false);return}
  if(n!==step)hist.push(snap);
  if(n===step){busy=false;await sayText(STEPS[step].say,false);return}
  showStep(n);
}
body.addEventListener("click",async e=>{
  const b=e.target.closest(".chip");if(!b||busy)return;busy=true;
  const s=STEPS[step],o=s.opts[+b.dataset.i],tk=chatToken;
  const snap={known:cloneKnown(known),step};
  b.classList.add("sel");b.parentElement.classList.add("picked");if(navigator.vibrate)navigator.vibrate(6);
  applyChoice(step,o);setProgress(filledCount());
  await react(o[3],o[4]);if(tk!==chatToken)return;
  afterReact(tk,snap);
});
body.addEventListener("input",e=>{
  if(e.target.id!=="dial")return;
  dialIdx=+e.target.value;dialTouched=true;paintDial();
  const x=STOPS[dialIdx];setMood(x.mood);hop();
  sayText(x.say,true,true);
});
body.addEventListener("click",async e=>{
  const any=e.target.closest("#dial-any");
  const ok=e.target.closest("#dial-ok");
  if((!any&&!ok)||busy)return;busy=true;
  const tk=chatToken,x=STOPS[dialIdx];
  const snap={known:cloneKnown(known),step};
  if(any||x.v===0)known.budget={any:true,label:"Spiller ingen rolle",part:""};
  else{known.budget={any:false,label:x.part.charAt(0).toUpperCase()+x.part.slice(1),part:x.part}}
  setProgress(filledCount());
  const line=any||x.v===0?(any?"Ingen grense. Gustav tar det som en tillitserklæring.":x.say):dialTouched?"Avtale. Nå lufter Gustav kjelleren.":x.say;
  const mood=any?"wink":x.mood;
  await react(line,mood);if(tk!==chatToken)return;
  afterReact(tk,snap);
});
$("#q").addEventListener("input",e=>$("#composer").classList.toggle("has",!!e.target.value.trim()));
$("#composer").addEventListener("submit",async e=>{
  e.preventDefault();const t=$("#q").value.trim();if(!t||busy)return;
  busy=true;const tk=chatToken;$("#q").value="";$("#composer").classList.remove("has");$("#q").blur();
  const snap={known:cloneKnown(known),step};
  const u=mergeUnderstand(t);
  const done=nextStep()===-1;
  setProgress(done?3:filledCount());
  if((step===0&&known.dish)||(step===1&&known.occasion)){const b=body.querySelector(".chips");if(b)b.classList.add("picked")}
  const d=acknowledge(u,done);
  await react(d[0],d[1]);if(tk!==chatToken)return;
  afterReact(tk,snap);
});
$("#ask-close").addEventListener("click",()=>{
  chatToken++;sayTk++;
  if(hist.length){const prev=hist.pop();known=cloneKnown(prev.known);showStep(prev.step,"prev");return}
  stack=[];go("home",false);
});
$("#ask-skip").addEventListener("click",()=>{
  chatToken++;sayTk++;
  const typed=$("#q").value.trim();if(typed)mergeUnderstand(typed);
  run(false);
});

/* ---------- Kjør søk + «Gustav lufter vinen» ---------- */
const LOADING=["Stryker barten og tenker","Konsulterer kjelleren i hodet","Lufter vinen. Og litt av egoet","Sjekker at flaskene sitter pent"];
function intro(p,empty,n){
  if(empty)return "Du ga meg ingenting å jobbe med, så jeg gikk på magefølelsen og smaksprofilen din. Gustav har sjelden feil.";
  const heads=["Utmerket valg.","Aha, en kjenner.","Mmm. Gustav liker dette.","Dette kan jeg."];
  const bits=[...new Set(p.words)].join(",")+typeWord(p)+budgetWord(p);
  return `${heads[hash(bits)%heads.length]} Her er mine ${n} forslag.`;
}
function heardTokens(){
  const t=[];
  if(known.dish&&known.dish.label)t.push(known.dish.label);
  if(known.method&&known.method.label&&!(known.occasion&&known.occasion.id==="grill"))t.push(known.method.label);
  if(known.type&&known.type.label)t.push(known.type.label);
  (known.mood||[]).forEach(m=>t.push(m.label));
  if(known.occasion&&known.occasion.label)t.push(known.occasion.label);
  if(known.budget&&!known.budget.any&&known.budget.label)t.push(known.budget.label);
  return t;
}
const DECANTER=`<svg class="dc" viewBox="0 0 160 200" aria-hidden="true">
  <defs><clipPath id="dclip"><path d="M64 22H96V54C96 74 140 84 140 130C140 168 116 188 80 188C44 188 20 168 20 130C20 84 64 74 64 54Z"/></clipPath></defs>
  <g clip-path="url(#dclip)"><g class="liq"><rect x="0" y="96" width="160" height="110" class="wine"/><path class="surf" d="M0 96H160" /></g></g>
  <path class="glass" d="M64 22H96V54C96 74 140 84 140 130C140 168 116 188 80 188C44 188 20 168 20 130C20 84 64 74 64 54Z"/>
  <g class="cork"><rect x="68" y="8" width="24" height="16" rx="3"/></g>
</svg>`;
let loadIv;
function run(more){
  let p,empty;
  if(!more){
    const text=searchText();
    empty=!text.trim();p=parse(text,[]);round=0;shown=[];lastQuery=text;lastP=p;lastEmpty=empty;
  }else{p=lastP;empty=lastEmpty;round++}
  if(cur!=="loading")go("loading",false);
  const dc=$("#decant");dc.classList.remove("pop");dc.innerHTML=DECANTER;
  const lines=LOADING.slice().sort(()=>Math.random()-.5);let li=0;
  const sub=$("#loading-sub");sub.textContent=lines[0];clearInterval(loadIv);
  
  setTimeout(()=>dc.classList.add("pop"),reduce?0:1050);
  setTimeout(()=>{
    clearInterval(loadIv);
    const picks=recommend(p,profile,lastQuery+round,shown);
    shown=shown.concat(picks.map(w=>w.id));
    const tk=empty?[]:heardTokens();
    $("#res-heard").innerHTML=tk.map(x=>`<span class="tk">${esc(x)}</span>`).join("");
    $("#res-gav").innerHTML=gustav(picks.length?"yum":"surprised");
    if(!picks.length){
      $("#res-intro").textContent="Hmm. Nå ble Gustav stille.";
      $("#cards").innerHTML=`<div class="empty"><div class="eg">${gustav("surprised")}</div><h2 class="title">Det var alle jeg hadde</h2><p class="sub">Prøv et nytt søk, så leter jeg videre.</p><button class="btn" id="again" type="button">Spør på nytt</button></div>`;
      $("#again").onclick=()=>$("#res-back").click();
      $("#more").hidden=true;
    }else{
      $("#more").hidden=false;
      $("#res-intro").textContent=more?"Åh, du vil ha mer? Gustav elsker engasjement. Prøv disse:":intro(p,empty,picks.length);
      $("#cards").innerHTML=picks.map((w,i)=>card(w,i)).join("");
    }
    stack=["home"];
    go("results",false);
    $("#res-scroll").scrollTop=0;
  },reduce?50:1650);
}
$("#more").addEventListener("click",()=>run(true));

/* ---------- Kort ---------- */
function heartBtn(id,on){return `<button class="heart" type="button" data-id="${id}" aria-pressed="${on}" aria-label="${on?"Fjern fra favoritter":"Legg til i favoritter"}">${ic("heart")}</button>`}
const vinUrl=w=>"https://www.vinmonopolet.no/search?q="+encodeURIComponent(w.name);
function card(w,i,opts={}){
  const on=favs.includes(w.id),hero=i===0&&!opts.plain;
  return `<article class="card ${hero?"hero":""}" data-id="${w.id}" style="--i:${i};${tileVar(w)}">
    ${hero?`<div class="pick">${gav("wink","sm")}<span>Gustavs favoritt</span></div>`:""}
    <div class="card-top">
      <div class="card-main">
        <div class="wtype"><i class="dot"></i>${esc(TYPE_LABEL[w.type])}</div>
        <button class="wine-open wname" type="button">${esc(w.name)}</button>
        <div class="worigin">${esc(w.country)} · ${esc(w.grape)}</div>
        <p class="wnote">${esc(w.note)}</p>
        ${hero?`<p class="wquip">«${esc(w.quip)}»</p>`:""}
      </div>
      <div class="tile">${bottle(w)}</div>
    </div>
    ${heartBtn(w.id,on)}
    <div class="card-foot">
      <div class="pricebox"><span class="price">${w.price}<small>kr</small></span><span class="stock">På lager</span></div>
      <a class="vin" href="${vinUrl(w)}" target="_blank" rel="noopener">Se på Vinmonopolet${ic("ext")}</a>
    </div>
  </article>`;
}

/* ---------- Favoritt (drueeksplosjon) ---------- */
function burst(x,y){
  if(reduce)return;
  const r=$("#app").getBoundingClientRect(),el=document.createElement("span");el.className="ripple";
  el.style.cssText=`left:${x-r.left-16}px;top:${y-r.top-16}px`;$("#fx").appendChild(el);
  el.animate([{transform:"scale(.5)",opacity:.7},{transform:"scale(2)",opacity:0}],{duration:520,easing:"cubic-bezier(.2,.7,.3,1)"}).onfinish=()=>el.remove();
}
function toggleFav(id,btn){
  const i=favs.indexOf(id),adding=i<0;
  adding?favs.push(id):favs.splice(i,1);
  store.set("vk_favs",favs);updateBadge();
  $$(`.heart[data-id="${id}"], .heart-btn[data-id="${id}"]`).forEach(h=>{
    h.setAttribute("aria-pressed",adding);
    h.setAttribute("aria-label",adding?"Fjern fra favoritter":"Legg til i favoritter");
    if(adding){h.classList.remove("pop");void h.offsetWidth;h.classList.add("pop")}
  });
  if(adding){
    const r=btn.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2);
    toast("Gustav husker den for deg.");if(navigator.vibrate)navigator.vibrate(8);
  }
  if(cur==="favs")setTimeout(renderFavs,adding?0:380);
}
function bindList(root){
  root.addEventListener("click",e=>{
    const h=e.target.closest(".heart");
    if(h){e.stopPropagation();toggleFav(h.dataset.id,h);return}
    if(e.target.closest(".vin"))return;
    const c=e.target.closest(".card");if(c)openSheet(c.dataset.id,c);
  });
}
bindList($("#cards"));bindList($("#fav-list"));

/* ---------- Favoritter ---------- */
function renderFavs(){
  const l=$("#fav-list"),list=favs.map(wineById).filter(Boolean);
  if(!list.length){
    l.innerHTML=`<div class="empty empty-fav"><div class="eg">${gustav("hello")}</div><h2 class="title">Ingen favoritter ennå</h2><p class="sub">Trykk på hjertet ved en vin, så husker Gustav den for deg.</p><button class="btn" id="fav-go" type="button">Finn en vin</button></div>`;
    $("#fav-go").onclick=()=>{stack=[];go("home",false)};return;
  }
  l.innerHTML=list.map((w,i)=>card(w,i,{plain:true})).join("");
}

/* ---------- Vinark ---------- */
let sheetFrom=null;
const meter=(v,max=5)=>`<span class="meter" aria-hidden="true">${Array.from({length:max},(_,i)=>`<i class="${i<Math.ceil(v)?"on":""}"></i>`).join("")}</span>`;
function openSheet(id,from){
  const w=wineById(id);if(!w)return;sheetFrom=from||null;
  const on=favs.includes(id);
  $("#sheet-body").innerHTML=`
    <div class="sh-hero" style="${tileVar(w)}">${bottle(w)}</div>
    <div class="sh-pad">
      <div class="overline" style="${tileVar(w)}"><i class="dot"></i>${esc(TYPE_LABEL[w.type])}</div>
      <h2 class="sh-name" id="sheet-name">${esc(w.name)}</h2>
      <div class="sh-origin">${esc(w.country)} · ${esc(w.region)}</div>
      <div class="sh-price"><span class="price">${w.price}<small>kr</small></span><span class="stock">På lager</span></div>
      <div class="gq">${gav("wink","md")}<div><blockquote>«${esc(w.quip)}»</blockquote><cite>Gustav mener</cite></div></div>
      <div class="sh-sec"><div class="overline">Smak</div><p>${esc(w.note)}</p></div>
      <div class="sh-sec"><div class="overline">Passer til</div><p>${esc(w.tip)}</p></div>
      <div class="group facts">
        <div class="kv"><span class="k">Drue</span><span class="v">${esc(w.grape)}</span></div>
        <div class="kv"><span class="k">Kropp</span><span class="v">${meter(w.body)}${bodyL(w.body)}</span></div>
        <div class="kv"><span class="k">Sødme</span><span class="v">${meter(w.sweet===0?1:w.sweet)}${sweetL(w.sweet)}</span></div>
      </div>
    </div>`;
  $("#sheet-bar").innerHTML=`<button class="heart-btn" type="button" data-id="${w.id}" aria-pressed="${on}" aria-label="${on?"Fjern fra favoritter":"Legg til i favoritter"}">${ic("heart")}</button>
    <a class="btn" href="${vinUrl(w)}" target="_blank" rel="noopener">Se på Vinmonopolet${ic("ext")}</a>`;
  $("#sheet-body").scrollTop=0;
  $("#scrim").hidden=false;$("#sheet").hidden=false;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{$("#scrim").classList.add("on");$("#sheet").classList.add("on")}));
  $("#sheet-close").focus({preventScroll:true});
}
function closeSheet(){
  $("#scrim").classList.remove("on");$("#sheet").classList.remove("on");$("#sheet").style.transform="";
  setTimeout(()=>{if(!$("#sheet").classList.contains("on")){$("#sheet").hidden=true;$("#scrim").hidden=true}},reduce?10:430);
  if(sheetFrom&&document.contains(sheetFrom))sheetFrom.querySelector(".wine-open")?.focus({preventScroll:true});
}
$("#sheet-close").addEventListener("click",closeSheet);
$("#scrim").addEventListener("click",closeSheet);
$("#sheet-bar").addEventListener("click",e=>{const h=e.target.closest(".heart-btn");if(h)toggleFav(h.dataset.id,h)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#sheet").classList.contains("on"))closeSheet()});
(function drag(){
  const g=$("#grab"),sh=$("#sheet");let y0=null,dy=0;
  g.addEventListener("pointerdown",e=>{y0=e.clientY;dy=0;sh.classList.add("drag");g.setPointerCapture(e.pointerId)});
  g.addEventListener("pointermove",e=>{if(y0==null)return;dy=Math.max(0,e.clientY-y0);sh.style.transform=`translateY(${dy}px)`});
  const end=()=>{if(y0==null)return;y0=null;sh.classList.remove("drag");if(dy>120)closeSheet();else sh.style.transform=""};
  g.addEventListener("pointerup",end);g.addEventListener("pointercancel",end);
})();

/* ---------- Profil ---------- */
const TYPES_L={R:"Rødvin",H:"Hvitvin",S:"Bobler",alt:"Litt av alt"};
function renderProfile(){
  $("#profile-g").innerHTML=gustav(profile?"wink":"hello");
  const l=$("#profile-list"),s=$("#profile-summary");
  if(!profile){
    s.textContent="«Svar på fem raske spørsmål, så treffer jeg bedre.»";
    l.innerHTML=`<div class="kv"><span class="k">Smaksprofil</span><span class="v">Ikke satt ennå</span></div>`;
    $("#redo").firstChild.textContent="Lag smaksprofil";return;
  }
  $("#redo").firstChild.textContent="Oppdater smaksprofil";
  s.textContent="«Gustav husker dette til neste gang.»";
  const b=profile.budget;
  const rows=[
    ["Sødme",profile.sweet<=0?"Tørt":profile.sweet<=2?"Halvtørt":"Søtt"],
    ["Kropp",profile.body<2?"Lett og frisk":profile.body<4?"Midt imellom":"Kraftig"],
    ["Foretrekker",TYPES_L[profile.types]||"Litt av alt"],
    ["Vanlig budsjett",b?(b[1]>=2000?"Over "+b[0]+" kr":b[0]===0?"Under "+b[1]+" kr":b[0]+"–"+b[1]+" kr"):"–"],
    ["Eventyrlyst",["Trygt og godt","Litt av hvert","Overrask meg"][profile.adv]||"–"]
  ];
  l.innerHTML=rows.map(r=>`<div class="kv"><span class="k">${r[0]}</span><span class="v">${esc(r[1])}</span></div>`).join("");
}
$("#clear-favs").addEventListener("click",()=>{favs=[];store.set("vk_favs",favs);updateBadge();toast("Favorittene er fjernet")});

/* ---------- Skann (stubb) ---------- */
$("#scan-g").innerHTML=gustav("hello");
let scanN=0;
$("#scan-btn").addEventListener("click",()=>{
  const m=["Gustav ser bare barten sin i speilet. Prøv igjen snart.","Fortsatt ingen etikett. Han øver.","Snart, lover Gustav. Med hånda på hjertet."];
  $("#scan-msg").textContent=m[Math.min(scanN++,m.length-1)];
});

/* ---------- Onboarding (Duolingo: fremdrift, feiring) ---------- */
const QS=[
 {k:"sweet",q:"Tørt eller søtt?",opts:[["Tørt","Det vanlige for meg",0],["Halvtørt","Litt rundhet er fint",2],["Søtt","Gi meg sukkeret",4]]},
 {k:"body",q:"Lett eller kraftig?",opts:[["Lett og frisk","Som en sommerbris",1.5],["Midt imellom","Alle skal være med",3],["Kraftig og fyldig","Gjerne litt dramatikk",4.5]]},
 {k:"types",q:"Rødt, hvitt eller bobler?",opts:[["Rødvin","",'R'],["Hvitvin","",'H'],["Bobler","Alltid en grunn",'S'],["Litt av alt","Gustav bestemmer","alt"]]},
 {k:"budget",q:"Hva bruker du på en vanlig flaske?",opts:[["Under 150 kr","Fornuftig",[0,150]],["150–250 kr","Gullkanten",[150,250]],["250–400 kr","Litt kos",[250,400]],["Over 400 kr","Gustav liker deg",[400,2000]]]},
 {k:"adv",q:"Trygt eller eventyrlig?",opts:[["Trygt og godt","Gi meg kjente druer",0],["Litt av hvert","Det beste av begge",1],["Overrask meg","Rare druer, takk",2]]}
];
let obStep=0,draft={};
const ob=$("#onboarding");
function showOb(pane){["welcome","quiz","done"].forEach(p=>$("#ob-"+p).hidden=p!==pane)}
function openOnboarding(fresh){
  obStep=0;draft={};
  ob.hidden=false;showOb(fresh===false?"quiz":"welcome");
  $("#ob-hero-g").innerHTML=gustav("hello");
  if(fresh===false)renderOb();
  requestAnimationFrame(()=>requestAnimationFrame(()=>ob.classList.add("active")));
}
function closeOb(){ob.classList.remove("active");setTimeout(()=>{ob.hidden=true},reduce?10:340)}
function renderOb(){
  const q=QS[obStep];
  $("#ob-progress i").style.width=(obStep/QS.length*100)+"%";
  $("#ob-progress").setAttribute("aria-valuenow",obStep);
  $("#ob-back").classList.toggle("show",obStep>0);
  $("#ob-step").textContent=`Spørsmål ${obStep+1} av ${QS.length}`;
  $("#ob-q").textContent=q.q;
  $("#ob-g").innerHTML=gustav(["hello","thinking","wink","thinking","hello"][obStep]);
  const o=$("#ob-options");
  o.innerHTML=q.opts.map((x,i)=>`<button class="opt" type="button" data-i="${i}" style="--i:${i}"><span><span class="t">${x[0]}</span>${x[1]?`<span class="s">${x[1]}</span>`:""}</span><span class="tick">${ic("check")}</span></button>`).join("");
}
$("#ob-start").addEventListener("click",()=>{showOb("quiz");renderOb()});
$("#ob-options").addEventListener("click",e=>{
  const b=e.target.closest(".opt");if(!b||b.dataset.lock)return;
  $$("#ob-options .opt").forEach(x=>{x.dataset.lock=1;x.classList.toggle("sel",x===b)});
  const q=QS[obStep],v=q.opts[+b.dataset.i][2];draft[q.k]=v;
  let d=420;
  if(q.k==="budget"&&v[1]===150){$("#ob-g").innerHTML=gustav("surprised");d=760}
  else $("#ob-g").innerHTML=gustav("wink");
  $("#ob-progress i").style.width=((obStep+1)/QS.length*100)+"%";
  setTimeout(()=>{
    if(obStep<QS.length-1){obStep++;renderOb()}
    else{
      profile=draft;store.set("vk_profile",profile);store.set("vk_onboarded",true);
      showOb("done");$("#ob-done-g").innerHTML=gustav("wink");confetti();
    }
  },reduce?30:d);
});
function confetti(){}
$("#ob-back").addEventListener("click",()=>{if(obStep>0){obStep--;renderOb()}});
const skipOb=()=>{store.set("vk_onboarded",true);closeOb()};
$("#ob-skip").addEventListener("click",skipOb);
$("#ob-close").addEventListener("click",skipOb);
$("#ob-finish").addEventListener("click",()=>{closeOb();renderProfile()});
$("#redo").addEventListener("click",()=>openOnboarding(false));

/* ---------- Toast ---------- */
let tt;
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(tt);tt=setTimeout(()=>t.classList.remove("show"),2000)}

/* ---------- Start ---------- */
$$(".screen").forEach(s=>{if(!s.classList.contains("active"))s.setAttribute("aria-hidden","true")});
updateBadge();
if(!store.get("vk_onboarded",false))openOnboarding(true);
})();
