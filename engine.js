/* Vinkelner – motor: tekstforståelse + rangering. Ingen DOM her. */
(function(){
"use strict";
/* ---------- Valg (hurtigfiltre) ---------- */
const CHIPS=[
 {id:"rod",label:"Rødvin",types:["R"]},{id:"hvit",label:"Hvitvin",types:["H"]},
 {id:"bobler",label:"Bobler",types:["S"]},{id:"rose",label:"Rosé",types:["P"]},
 {id:"middag",label:"Til middag",tags:["kjott","kylling","pasta","fisk"]},
 {id:"fest",label:"Fest",tags:["fest"]},{id:"gave",label:"Gave",tags:["fest"],min:250,max:450},
 {id:"u150",label:"Under 150 kr",max:150},{id:"u300",label:"Under 300 kr",max:300}
];

/* ---------- Tekstforståelse ---------- */
const FOOD=[
 [/laks|ørret|sjøørret/,["laks","fisk"],"laks"],
 [/torsk|sei\b|hyse|kveite|skrei|breiflabb|klippfisk/,["torsk","fisk"],"torsk"],
 [/\bfisk|sjømat|fiskesuppe|fiskekaker/,["fisk"],"fisk"],
 [/skalldyr|reker|krabbe|hummer|kreps|østers|skjell|scampi|kamskjell/,["skalldyr","fisk"],"skalldyr"],
 [/sushi|sashimi|poke/,["sushi","fisk"],"sushi"],
 [/biff|entrec|steak|indrefilet|oksekjøtt|burger|hamburger|ribeye|kjøttdeig/,["biff","kjott"],"biff"],
 [/kjøtt|kjott|kjøttkake|lapskaus/,["kjott"],"kjøtt"],
 [/\blam\b|lamme|fårikål/,["lam","kjott"],"lam"],
 [/vilt|elg|hjort|rein|rådyr|\bhare\b/,["vilt","kjott"],"vilt"],
 [/gryte|stek|stuing|bolognese|ragu|chili/,["gryte","kjott"],"gryte"],
 [/svin|ribbe|pinnekjøtt|kotelett|bacon|pølse|skinke|pulled/,["svin","kjott"],"svin"],
 [/kylling|kalkun|\band\b|ender|gås/,["kylling"],"kylling"],
 [/pasta|spaghetti|lasagne|risotto|carbonara|tagliatelle|gnocchi/,["pasta"],"pasta"],
 [/pizza/,["pizza"],"pizza"],
 [/\bost\b|osten|oster|ostefat|brie|chèvre|parmesan|raclette|fondue/,["ost"],"ost"],
 [/taco|tex-?mex|fajita|burrito|nachos|enchilada/,["taco"],"taco"],
 [/dessert|kake|sjokolade|iskrem|søtt|søtsak|pai\b|karamell/,["dessert"],"dessert"],
 [/\bfest\b|fest|bursdag|feiring|feire|nyttår|jubileum|konfirmasjon|bryllup|skål|champagne|selskap|forlovelse|jul\b/,["fest"],"fest"],
 [/grill|bbq|grillet|grillmat|kullgrill/,["grill"],"grill"],
 [/tapas|småretter|pintxos/,["tapas"],"tapas"],
 [/vegetar|vegansk|salat|grønnsak|falafel|hummus/,["vegetar"],"vegetar"],
 [/asiatisk|thai|indisk|kinesisk|karri|curry|vietnam|wok|ramen/,["asiatisk"],"asiatisk"],
 [/aperitiff|før maten|terrasse|solnedgang|sommer|piknik|forrett/,["aperitiff"],"aperitiff"],
 [/sopp|trøffel/,["sopp"],"sopp"]
];
const TYPES=[
 [/rødvin|rød vin|\brød\b|\brøde\b/,"R"],[/hvitvin|hvit vin|\bhvit\b|\bhvite\b/,"H"],
 [/rosé|rosevin|\brose\b/,"P"],[/bobler|musserende|champagne|cava|prosecco|crémant|cremant|boblevin|sekt/,"S"]
];
const COUNTRY=[[/frankrike|fransk/,"Frankrike"],[/italia|italiensk/,"Italia"],[/spania|spansk/,"Spania"],[/tysk/,"Tyskland"],[/portug/,"Portugal"],[/chile/,"Chile"],[/argentin/,"Argentina"],[/østerrik/,"Østerrike"],[/usa|amerikansk|california/,"USA"],[/austral/,"Australia"],[/sør-?afrika/,"Sør-Afrika"],[/new zealand|ny-?sjøland/,"New Zealand"],[/ungarn|ungarsk/,"Ungarn"]];

function parse(text,chips){
  const t=" "+(text||"").toLowerCase().replace(/\s+/g," ")+" ";
  const p={tags:new Set(),types:new Set(),max:null,target:null,min:null,words:[],sweet:null,body:null,countries:[],grapeHit:[],raw:text||""};
  FOOD.forEach(([re,tags,word])=>{if(re.test(t)){tags.forEach(x=>p.tags.add(x));p.words.push(word)}});
  TYPES.forEach(([re,ty])=>{if(re.test(t))p.types.add(ty)});
  COUNTRY.forEach(([re,c])=>{if(re.test(t))p.countries.push(c)});
  // budsjett
  let m;
  if((m=t.match(/(?:under|maks(?:imalt)?|max|inntil|opptil|ikke over|mindre enn)\s*(\d{2,4})/)))p.max=+m[1];
  else if((m=t.match(/(?:rundt|ca\.?|cirka|omtrent|ca|på)\s*(\d{2,4})/)))p.target=+m[1];
  else if((m=t.match(/(\d{2,4})\s*(?:kr|,-|kroner|lapper|nok)/)))p.target=+m[1];
  else if((m=t.match(/(?:til|for)\s*(\d{2,4})\b/)))p.max=+m[1];
  if(/billig|rimelig|økonomisk|spar/.test(t)&&p.max==null&&p.target==null)p.max=140;
  if(/dyr|luksus|spesiell|flott|eksklusiv/.test(t)&&p.max==null&&p.target==null)p.min=350;
  if(/gave|presang|vertinne|vertskap/.test(t)){p.min=p.min||250;p.tags.add("fest");p.words.push("gave")}
  // stemning
  if(/kraftig|fyldig|tung|mørk/.test(t))p.body=4.5;
  if(/\blett\b|frisk|lys\b/.test(t))p.body=1.5;
  if(/\btørr/.test(t))p.sweet=0;
  if(/halvtørr/.test(t))p.sweet=2;
  if(/\bsøt/.test(t)&&!p.tags.has("dessert")){p.sweet=3}
  if(/romantisk|date|hyggelig for to|kjæreste/.test(t)){p.tags.add("fest");p.tags.add("aperitiff");p.words.push("romantikk")}
  if(/koselig|hygge|sofa|vinterkveld|peis/.test(t)&&p.body==null)p.body=4;
  // chips
  chips.forEach(id=>{const c=CHIPS.find(x=>x.id===id);if(!c)return;
    (c.types||[]).forEach(x=>p.types.add(x));(c.tags||[]).forEach(x=>p.tags.add(x));
    if(c.max)p.max=p.max==null?c.max:Math.min(p.max,c.max);if(c.min)p.min=c.min;});
  return p;
}
function typeWord(p){return [...p.types].map(x=>({R:"rødvin",H:"hvitvin",P:"rosé",S:"bobler"}[x])).join(" eller ")}
function budgetWord(p){
  if(p.max)return "under "+p.max+" kr"; if(p.target)return "rundt "+p.target+" kr"; if(p.min)return "fra "+p.min+" kr"; return "";
}

/* ---------- Rangering ---------- */
const COMMON=["Pinot noir","Merlot / Cabernet sauvignon","Cabernet sauvignon","Chardonnay","Sauvignon blanc","Pinot grigio","Sangiovese","Tempranillo","Riesling","Malbec","Shiraz","Glera"];
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rnd(seed){let x=seed%2147483647||1;return()=>(x=x*48271%2147483647)/2147483647}
// Metode/anledning veier mindre enn selve råvaren («grillet laks» skal være laks først)
const TAGW={grill:1.5,aperitiff:2,fest:2.5,tapas:3,vegetar:4};
function score(w,p,prof,jit){
  let s=0, matched=0;
  p.tags.forEach(tg=>{if(w.tags.includes(tg)){s+=(TAGW[tg]||5);matched++}});
  if(p.tags.size&&!matched)s-=3;
  if(p.types.size){s+=p.types.has(w.type)?9:-14}
  if(p.countries.length)s+=p.countries.includes(w.country)?6:-2;
  const nm=(w.name+" "+w.grape+" "+w.region).toLowerCase();
  (p.raw.toLowerCase().match(/[a-zæøåéèô]{5,}/g)||[]).forEach(tok=>{if(nm.includes(tok)){s+=5}});
  // dessertviner bare når det passer
  if(w.sweet>=4&&!p.tags.has("dessert")&&p.sweet==null)s-=8;
  if(p.tags.has("dessert")&&w.sweet<3)s-=2;
  if(p.tags.has("dessert")&&w.type==="P"&&!p.types.has("P"))s-=7;
  // bobler passer sjelden til en vanlig middag med mindre noen ber om det
  if(w.type==="S"&&!p.types.size&&!p.tags.has("fest")&&!p.tags.has("aperitiff")&&p.tags.size)s-=5;
  if(w.type==="P"&&!p.types.size&&(p.tags.has("vilt")||p.tags.has("biff")||p.tags.has("gryte")))s-=6;
  // budsjett
  const pr=w.price;
  if(p.max!=null){ if(pr>p.max)s-=60; else s+=1+2*(pr/p.max); }
  if(p.target!=null){ const d=Math.abs(pr-p.target)/p.target;
    if(pr>p.target*1.3)s-=40; else if(d<.35)s+=4.5*(1-d/.35); else if(pr<p.target*.6)s-=2; }
  if(p.min!=null&&pr<p.min)s-=40;
  // stemning
  if(p.body!=null)s-=Math.abs(w.body-p.body)*1.2;
  if(p.sweet!=null)s-=Math.abs(w.sweet-p.sweet)*1.2;
  // smaksprofil
  if(prof){
    if(prof.types&&prof.types!=="alt"&&!p.types.size){s+= prof.types===w.type?2.2:(prof.types==="R"||prof.types==="H")&&w.type==="P"?0:-1.2}
    if(prof.sweet!=null&&p.sweet==null&&!p.tags.has("dessert"))s-=Math.abs(w.sweet-prof.sweet)*0.9;
    if(prof.body!=null&&p.body==null)s-=Math.abs(w.body-prof.body)*0.8;
    if(prof.budget&&p.max==null&&p.target==null&&p.min==null){const [lo,hi]=prof.budget;
      if(pr>=lo&&pr<=hi)s+=1.5;else s-=Math.min(2.5,Math.abs(pr<lo?lo-pr:pr-hi)/100);}
    if(prof.adv!=null){const common=COMMON.includes(w.grape);s+= prof.adv===0?(common?1:-.5):prof.adv===2?(common?-.8:1.2):0}
  }
  return s+jit;
}
function recommend(p,prof,seedKey,exclude){
  const r=rnd(hash(seedKey));
  let cand=WINES.filter(w=>!exclude.includes(w.id)).map(w=>({w,s:score(w,p,prof,r()*1.4)}));
  const picks=[];
  while(picks.length<4&&cand.length){
    cand.forEach(c=>{c.adj=c.s-(p.types.size===1?1.2:5.5)*picks.filter(x=>x.w.type===c.w.type).length});
    cand.sort((a,b)=>b.adj-a.adj);
    // variasjon skal aldri trekke inn dårlige treff: hold deg innenfor 6 poeng av beste råscore
    const top=Math.max(...cand.map(c=>c.s));const ok=cand.filter(c=>c.s>=top-6);if(ok.length){cand=ok.concat(cand.filter(c=>c.s<top-6))}
    if(!p.types.size){const meaty=["vilt","biff","gryte","lam"].some(x=>p.tags.has(x));const cap=t=>t==="P"||t==="S"?1:(t==="R"&&meaty?4:2);const fit=cand.filter(c=>picks.filter(x=>x.w.type===c.w.type).length<cap(c.w.type));if(fit.length)cand=fit.concat(cand.filter(c=>!fit.includes(c)))}
    const best=cand.shift(); if(best.s<-20&&picks.length>=3)break; picks.push(best);
  }
  return picks.map(x=>x.w);
}


window.VKE={CHIPS,parse,recommend,score,hash,typeWord,budgetWord};
})();
