/* Gustav v5 – redaksjonell strekfigur: blekk, sand og én aksent. Fargene styres av CSS-variabler (--g-*). */
(function(){
const half=(d)=>`<path d="${d}"/><path d="${d}" transform="translate(120 0) scale(-1 1)"/>`;
const MOUSTACHE=half("M60 64.5 C66 61.5 73 62 78 66 C82 69 86 68.5 88.5 63.5 C90.2 59.6 95 60.6 94.4 65.2 C93.6 72.6 86 78.4 78.5 77.2 C72 76.2 67 73.4 60 75.2Z");
const INK="var(--g-ink)",MARK="var(--g-bow)";
const MOODS={
 hello:{
  brows:`<path d="M40 41q7-4 15-1.5M65 39.5q8-2.5 15 1.5"/>`,
  eyes:`<circle cx="47" cy="52" r="3.3"/><circle cx="73" cy="52" r="3.3"/>`,
  mouth:`<path d="M52 82q8 7 16 0" fill="none"/>`,extra:``},
 thinking:{
  brows:`<path d="M39 37q8-5 16-2.5"/><path d="M65 41.5q8-1 15 2.5"/>`,
  eyes:`<circle cx="50" cy="50" r="3.3"/><circle cx="76" cy="50" r="3.3"/>`,
  mouth:`<path d="M55 83q6 1.600 12-1.500" fill="none"/>`,
  extra:`<g fill="none" stroke="${INK}" stroke-width="2" opacity=".75"><circle cx="99" cy="27" r="2.200"/><circle cx="105" cy="19" r="3.200"/><circle cx="112" cy="9" r="4.200"/></g>`},
 wink:{
  brows:`<path d="M40 41q7-4 15-1.500M65 37q8-4 15 0"/>`,
  eyes:`<circle cx="47" cy="52" r="3.300"/><path d="M67.500 53q5.500-6 11 0" fill="none"/>`,
  mouth:`<path d="M50 81q10 9 20 0" fill="none"/>`,extra:``},
 yum:{
  brows:`<path d="M40 39q7-5 15-2M65 37q8-3 15 2"/>`,
  eyes:`<path d="M41.500 53q5.500-7 11 0M67.500 53q5.500-7 11 0" fill="none"/>`,
  mouth:`<path d="M50 80q10 12 20 0z" fill="${INK}"/>`,
  extra:`<path d="M100 14l2 5.200 5.200 2-5.200 2-2 5.200-2-5.200-5.200-2 5.200-2z" fill="${MARK}" stroke="none"/>`},
 sly:{
  brows:`<path d="M40 44l15-3"/><path d="M65 36q8-4 15-.5"/>`,
  eyes:`<path d="M42 52.500h10M68 52.500h10" fill="none"/>`,
  mouth:`<path d="M52 83q9 5 17-4" fill="none"/>`,extra:``},
 surprised:{
  brows:`<path d="M40 36q7-5 15-1.500M65 34.500q8-3.500 15 1.500"/>`,
  eyes:`<circle cx="47" cy="52" r="4.600"/><circle cx="73" cy="52" r="4.600"/>`,
  mouth:`<ellipse cx="60" cy="84" rx="4.200" ry="5.200" fill="${INK}" stroke="none"/>`,
  extra:`<g stroke="${INK}" stroke-width="2.200" stroke-linecap="round" fill="none" opacity=".75"><path d="M17 26l5 3M14 38h6M103 26l-5 3M106 38h-6"/></g>`}
};
window.gustav=function(mood="hello",cls=""){
 const m=MOODS[mood]||MOODS.hello;
 return `<svg class="gustav g-${mood} ${cls}" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
 <path d="M16 121C16 101 36 95 60 95s44 6 44 26z" fill="var(--g-jacket)"/>
 <path d="M50 95.500L60 108l10-12.500z" fill="var(--g-shirt)"/>
 <rect x="52" y="82" width="16" height="15" rx="6" fill="var(--g-skin2)"/>
 <g fill="var(--g-skin)" stroke="${INK}" stroke-width="2.200"><circle cx="27.500" cy="57" r="6.200"/><circle cx="92.500" cy="57" r="6.200"/><ellipse cx="60" cy="54" rx="33" ry="33"/></g>
 <path d="M26.500 49C23.500 30 39 19.500 60 19.500S96.500 30 93.500 49C91.500 42 87.500 37.500 81 36C75 34 68 31 60 31.500S45 34 39 36C32.500 37.500 28.500 42 26.500 49z" fill="${INK}"/>
 <ellipse cx="60" cy="61" rx="5.500" ry="4.500" fill="var(--g-skin2)"/>
 <g fill="none" stroke="${INK}" stroke-width="2.800" stroke-linecap="round" stroke-linejoin="round">${m.brows}</g>
 <g class="eyes" fill="${INK}" stroke="${INK}" stroke-width="2.800" stroke-linecap="round">${m.eyes}</g>
 <g class="mous" fill="${INK}">${MOUSTACHE}</g>
 <g stroke="${INK}" stroke-width="2.800" stroke-linecap="round" stroke-linejoin="round">${m.mouth}</g>
 <g fill="${MARK}" stroke="${MARK}" stroke-width="2.600" stroke-linejoin="round"><path d="M60 98L48.500 93v10z"/><path d="M60 98l11.500-5v10z"/></g>
 <circle cx="60" cy="98" r="3.800" fill="${INK}"/>
 ${m.extra}
 </svg>`;
};
})();
