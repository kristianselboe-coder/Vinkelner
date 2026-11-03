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
 [/påskelam|\blam\b|lamme|fårikål/,["lam","kjott"],"lam"],
 [/vilt|elg|hjort|rein|rådyr|\bhare\b/,["vilt","kjott"],"vilt"],
 [/gryte|stek|stuing|bolognese|ragu|chili/,["gryte","kjott"],"gryte"],
 [/svin|ribbe|pinnekjøtt|kotelett|bacon|pølse|skinke|pulled/,["svin","kjott"],"svin"],
 [/kylling|kalkun|\band\b|ender|gås/,["kylling"],"kylling"],
 [/pasta|spaghetti|lasagne|risotto|carbonara|tagliatelle|gnocchi/,["pasta"],"pasta"],
 [/pizza/,["pizza"],"pizza"],
 [/\bost\b|osten|oster|ostefat|brie|chèvre|parmesan|raclette|fondue/,["ost"],"ost"],
 [/taco|tex-?mex|fajita|burrito|nachos|enchilada/,["taco"],"taco"],
 [/dessert|kake|sjokolade|iskrem|søtt|søtsak|pai\b|karamell/,["dessert"],"dessert"],
 [/\bfest\b|bursdag|feiring|\bfeire\b|nyttår|jubileum|konfirmasjon|bryllup|\bskål\b|champagne|selskap|forlov|jule|\bjul\b|\bpåske\b/,["fest"],"fest"],
 [/grill|bbq|grillet|grillmat|kullgrill/,["grill"],"grill"],
 [/tapas|småretter|pintxos/,["tapas"],"tapas"],
 [/vegetar|vegansk|salat|grønnsak|falafel|hummus/,["vegetar"],"vegetar"],
 [/asiatisk|thai|indisk|kinesisk|karri|curry|vietnam|wok|ramen/,["asiatisk"],"asiatisk"],
 [/aperitiff|før maten|terrasse|solnedgang|sommer|piknik|forrett/,["aperitiff"],"aperitiff"],
 [/sopp|trøffel/,["sopp"],"sopp"]
];
/* Anledninger. Rekkefølgen er prioritet: «svigers på lørdag» er svigers, ikke hverdag.
   «grillet» er tilberedning (FOOD over) og skal ikke telle som grill-anledning. */
const OCCASIONS=[
 {id:"svigers",re:/sviger/,label:"Svigers",tags:["fest"],word:"svigers"},
 {id:"date",re:/\bdate\b|romantisk|kjæreste|hyggelig for to/,label:"Date",tags:["fest","aperitiff"],word:"date"},
 {id:"bursdag",re:/bursdag/,label:"Bursdag",tags:["fest"],word:"bursdag"},
 {id:"jul",re:/\bjul\b|jule|jula\b/,label:"Jul",tags:["fest"],word:"jul"},
 {id:"paske",re:/påske/,label:"Påske",tags:["fest"],word:"påske"},
 {id:"hytte",re:/hytte/,label:"Hytte",tags:[],word:"hytte"},
 {id:"feiring",re:/forlov|bryllup|jubileum|konfirmasjon|nyttår|feiring|\bfeire\b|\bskål\b/,label:"Feiring",tags:["fest"],word:"feiring"},
 {id:"middag",re:/middagsselskap|middag med|selskap|\bgjester\b/,label:"Middagsselskap",tags:["fest"],word:"middag"},
 {id:"gave",re:/\bgave\b|presang|vertinne|vertskap/,label:"Gave",tags:["fest"],word:"gave"},
 {id:"grill",re:/bbq|grillfest|grilling|på grillen|\bgrill\b/,label:"Grill",tags:["grill"],word:"grill"},
 {id:"fest",re:/\bfest\b|festlig/,label:"Fest",tags:["fest"],word:"fest"},
 {id:"hverdag",re:/hverdag|ukedag|mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag/,label:"Hverdag",tags:[],word:"hverdag"}
];
const DISH_ORDER=["laks","torsk","skalldyr","sushi","biff","lam","vilt","svin","kylling","pizza","pasta","taco","dessert","ost","tapas","asiatisk","sopp","aperitiff","vegetar","gryte","fisk","kjøtt"];
const DISH_LABEL={laks:"Laks",torsk:"Torsk",skalldyr:"Skalldyr",sushi:"Sushi",biff:"Biff",lam:"Lam",vilt:"Vilt",svin:"Svin",kylling:"Kylling",pizza:"Pizza",pasta:"Pasta",taco:"Taco",dessert:"Dessert",ost:"Ost",tapas:"Tapas",asiatisk:"Asiatisk",sopp:"Sopp",aperitiff:"Aperitiff",vegetar:"Vegetar",gryte:"Gryte",fisk:"Fisk",kjøtt:"Kjøtt"};
const DAYS=/mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag/;
const TYPES=[
 [/rødvin|rød vin|\brød\b|\brøde\b/,"R"],[/hvitvin|hvit vin|\bhvit\b|\bhvite\b/,"H"],
 [/rosé|rosevin|\brose\b/,"P"],[/bobler|musserende|champagne|cava|prosecco|crémant|cremant|boblevin|sekt/,"S"]
];
const COUNTRY=[[/frankrike|fransk/,"Frankrike"],[/italia|italiensk/,"Italia"],[/spania|spansk/,"Spania"],[/tysk/,"Tyskland"],[/portug/,"Portugal"],[/chile/,"Chile"],[/argentin/,"Argentina"],[/østerrik/,"Østerrike"],[/usa|amerikansk|california/,"USA"],[/austral/,"Australia"],[/sør-?afrika/,"Sør-Afrika"],[/new zealand|ny-?sjøland/,"New Zealand"],[/ungarn|ungarsk/,"Ungarn"]];

function parse(text,chips){
  const t=" "+(text||"").toLowerCase().replace(/\s+/g," ")+" ";
  const p={tags:new Set(),types:new Set(),max:null,target:null,min:null,words:[],sweet:null,body:null,countries:[],grapeHit:[],raw:text||"",budgetAny:false,budgetLabel:null};
  FOOD.forEach(([re,tags,word])=>{if(re.test(t)){tags.forEach(x=>p.tags.add(x));p.words.push(word)}});
  TYPES.forEach(([re,ty])=>{if(re.test(t))p.types.add(ty)});
  COUNTRY.forEach(([re,c])=>{if(re.test(t))p.countries.push(c)});
  // budsjett
  let m;
  if((m=t.match(/(?:under|maks(?:imalt)?|max|inntil|opptil|ikke over|mindre enn)\s*(\d{2,4})/)))p.max=+m[1];
  else if((m=t.match(/(?:rundt|ca\.?|cirka|omtrent|ca|på)\s*(\d{2,4})/)))p.target=+m[1];
  else if((m=t.match(/(\d{2,4})\s*(?:kr|,-|kroner|lapper|nok)/)))p.target=+m[1];
  else if((m=t.match(/(?:til|for)\s*(\d{2,4})\b/)))p.max=+m[1];
  if(p.max==null&&p.target==null&&p.min==null){
    if(/billig|rimelig|økonomisk|spar/.test(t)){p.max=140;p.budgetLabel="Billig"}
    else if(/litt dyrere|et hakk dyrere|ikke den billigste|\bdyrere\b/.test(t)){p.target=280;p.budgetLabel="Litt dyrere"}
    else if(/\b(dyr|luksus|spesiell|flott|eksklusiv)\b/.test(t))p.min=350;
    else if(/spiller ingen rolle|ingen rolle|helt likegyldig|uten budsjett|uansett pris|ingen grense/.test(t))p.budgetAny=true;
  }
  if(p.max!=null&&!p.budgetLabel)p.budgetLabel="Under "+p.max+" kr";
  if(p.target!=null&&!p.budgetLabel)p.budgetLabel="Rundt "+p.target+" kr";
  if(p.min!=null&&!p.budgetLabel)p.budgetLabel="Fra "+p.min+" kr";
  if(/gave|presang|vertinne|vertskap/.test(t)){p.min=p.min||250;p.tags.add("fest");p.words.push("gave")}
  // stemning
  if(/kraftig|fyldig|tung|mørk/.test(t))p.body=4.5;
  if(/\blett\b|frisk|lys\b/.test(t))p.body=1.5;
  if(/\btørr/.test(t))p.sweet=0;
  if(/halvtørr/.test(t))p.sweet=2;
  if(/\bsøt/.test(t)&&!p.tags.has("dessert")){p.sweet=3}
  if(/romantisk|date|hyggelig for to|kjæreste/.test(t)){p.tags.add("fest");p.tags.add("aperitiff");p.words.push("romantikk")}
  if(/koselig|hygge|sofa|vinterkveld|peis/.test(t)&&p.body==null)p.body=4;
  OCCASIONS.forEach(o=>{
    if(!o.re.test(t))return;
    o.tags.forEach(x=>p.tags.add(x));
    if(o.word&&!p.words.includes(o.word))p.words.push(o.word);
  });
  // chips
  chips.forEach(id=>{const c=CHIPS.find(x=>x.id===id);if(!c)return;
    (c.types||[]).forEach(x=>p.types.add(x));(c.tags||[]).forEach(x=>p.tags.add(x));
    if(c.max)p.max=p.max==null?c.max:Math.min(p.max,c.max);if(c.min)p.min=c.min;});
  return p;
}
function typeWord(p){return [...p.types].map(x=>({R:"rødvin",H:"hvitvin",P:"rosé",S:"bobler"}[x])).join(" eller ")}
function budgetWord(p){
  if(p.budgetAny)return "";
  if(p.budgetLabel==="Billig"||p.budgetLabel==="Litt dyrere")return p.budgetLabel.toLowerCase();
  if(p.max)return "under "+p.max+" kr"; if(p.target)return "rundt "+p.target+" kr"; if(p.min)return "fra "+p.min+" kr"; return "";
}
function dishOf(p,text){
  const have=new Set(p.words),t=(text||"").toLowerCase();
  if(have.has("pizza")&&have.has("pasta"))return {id:"pasta",label:"Pasta og pizza",query:"pasta pizza"};
  if(have.has("ost")&&have.has("tapas"))return {id:"ost",label:"Ost og tapas",query:"ost tapas"};
  for(const id of DISH_ORDER){
    if(!have.has(id))continue;
    let label=DISH_LABEL[id];
    if(id==="skalldyr"&&/reker/.test(t))label="Reker";
    else if(id==="laks"&&/ørret/.test(t))label="Ørret";
    return {id,label,query:id};
  }
  return null;
}
function occasionOf(text){
  const t=" "+(text||"").toLowerCase().replace(/\s+/g," ")+" ";
  for(const o of OCCASIONS){
    if(!o.re.test(t))continue;
    let label=o.label;
    if(o.id==="hverdag"){const d=t.match(DAYS);if(d)label=d[0].charAt(0).toUpperCase()+d[0].slice(1)}
    return {id:o.id,label,word:o.word,query:o.word};
  }
  return null;
}
function budgetOf(p){
  if(p.budgetAny)return {any:true,label:"Spiller ingen rolle",part:""};
  if(p.max==null&&p.target==null&&p.min==null)return null;
  const part=p.target!=null?"rundt "+p.target+" kr":p.max!=null?"under "+p.max+" kr":"fra "+p.min+" kr";
  return {any:false,label:p.budgetLabel||budgetWord(p),part,max:p.max,target:p.target,min:p.min};
}
function typeOf(p){
  if(!p.types.size)return null;
  const map={R:"Rødvin",H:"Hvitvin",P:"Rosé",S:"Bobler"};
  const ids=[...p.types];
  return {ids,label:ids.map(x=>map[x]).join(" eller "),query:ids.map(x=>map[x].toLowerCase()).join(" ")};
}
function moodOf(p,text){
  const t=(text||"").toLowerCase(),out=[];
  if(p.body!=null&&p.body<=2){
    const both=/\blett\b/.test(t)&&/frisk/.test(t);
    out.push({id:"lett",label:both?"Lett og frisk":/frisk/.test(t)&&!/\blett\b/.test(t)?"Frisk":"Lett"});
  }else if(p.body!=null&&p.body>=4)out.push({id:"fyldig",label:/koselig|hygge|peis/.test(t)?"Koselig":"Fyldig"});
  if(p.sweet===0)out.push({id:"torr",label:"Tørr"});
  else if(p.sweet===2)out.push({id:"halv",label:"Halvtørr"});
  else if(p.sweet!=null&&p.sweet>=3)out.push({id:"sot",label:"Søt"});
  return out;
}
function methodOf(text){
  return /grillet|grillmat|kullgrill/.test((text||"").toLowerCase())?{id:"grill",label:"Grillet"}:null;
}
/* Hva fri tekst allerede har svart på. Samtalen spør bare om resten. */
function understand(text){
  const p=parse(text,[]);
  return {raw:text||"",p,dish:dishOf(p,text),occasion:occasionOf(text),budget:budgetOf(p),type:typeOf(p),mood:moodOf(p,text),method:methodOf(text)};
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


window.VKE={CHIPS,parse,recommend,score,hash,typeWord,budgetWord,understand};
})();
