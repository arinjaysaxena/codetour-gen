// Static HTML generator: a single self-contained page with a step sidebar, code pane and keyboard nav.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Embedded JSON must not be able to close the script tag.
const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);

const CSS = `
:root{--bg:#fff;--fg:#1c1f24;--mut:#667;--side:#f4f5f7;--acc:#2457d6;--hl:#fff3b0;--code:#fafafa;--bd:#dde}
@media(prefers-color-scheme:dark){:root{--bg:#14161a;--fg:#e6e8eb;--mut:#99a;--side:#1b1e23;--acc:#7aa2ff;--hl:#4a4320;--code:#181b20;--bd:#2c3038}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg);display:flex;height:100vh}
nav{width:300px;overflow:auto;background:var(--side);border-right:1px solid var(--bd);padding:12px}
nav h1{font-size:16px;margin:0 0 8px}nav button{display:block;width:100%;text-align:left;border:0;background:none;color:inherit;padding:6px 8px;border-radius:6px;cursor:pointer;font:inherit}
nav button.on{background:var(--acc);color:#fff}nav small{display:block;opacity:.7;font-size:12px}
main{flex:1;display:flex;flex-direction:column;min-width:0}
#story{padding:16px 20px;border-bottom:1px solid var(--bd)}#story h2{margin:0 0 4px;font-size:18px}#story p{margin:6px 0;max-width:80ch}
#path{color:var(--mut);font:13px monospace}#ctl{margin-top:8px}#ctl button{padding:4px 12px;margin-right:6px}
pre{margin:0;flex:1;overflow:auto;background:var(--code);font:13px/1.5 ui-monospace,monospace;padding:8px 0}
.l{display:block;padding:0 16px 0 0;white-space:pre}.l i{display:inline-block;width:4em;text-align:right;color:var(--mut);margin-right:12px;font-style:normal;user-select:none}
.l.hl{background:var(--hl)}
@media(max-width:700px){body{flex-direction:column;height:auto}nav{width:auto;max-height:30vh}}
`;

const CLIENT = `
const T=JSON.parse(document.getElementById('data').textContent);let cur=0;
const nav=document.getElementById('steps'),code=document.getElementById('code');
T.stops.forEach((s,i)=>{const b=document.createElement('button');b.innerHTML='<b></b><small></small>';
b.firstChild.textContent=s.index+'. '+s.title;b.lastChild.textContent=s.path;b.onclick=()=>show(i);nav.appendChild(b)});
function show(i){cur=Math.max(0,Math.min(T.stops.length-1,i));const s=T.stops[cur];
[...nav.children].forEach((b,j)=>b.classList.toggle('on',j===cur));
document.getElementById('title').textContent=s.index+'. '+s.title;
document.getElementById('path').textContent=s.path;document.getElementById('narr').textContent=s.narration;
const hl=s.highlight||[1,1];code.textContent='';
s.code.split('\\n').forEach((t,n)=>{const d=document.createElement('span');d.className='l'+(n+1>=hl[0]&&n+1<=hl[1]?' hl':'');
const g=document.createElement('i');g.textContent=n+1;d.append(g,t||' ');code.appendChild(d)});
const f=code.querySelector('.hl');if(f)code.scrollTop=Math.max(0,f.offsetTop-80);else code.scrollTop=0;
history.replaceState(null,'','#'+s.index)}
document.getElementById('prev').onclick=()=>show(cur-1);document.getElementById('next').onclick=()=>show(cur+1);
addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='j')show(cur+1);if(e.key==='ArrowLeft'||e.key==='k')show(cur-1)});
show((parseInt(location.hash.slice(1),10)||1)-1);
`;

/** Highlight the first ~25 lines of the file: where the tour wants the reader to look. */
export const defaultHighlight = (source, max = 25) => [1, Math.min(max, Math.max(1, source.split('\n').length))];

/** Render the tour page. `stops` come from narrateTour; `files` supply the source shown in the code pane. */
export function renderTourHtml({ title, stops }, files) {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const data = { stops: stops.map((s) => {
    const source = byPath.get(s.path)?.source ?? '';
    return { index: s.index, title: s.title, path: s.path, narration: s.narration, code: source, highlight: s.highlight ?? defaultHighlight(source) };
  }) };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><nav><h1>${esc(title)}</h1><div id="steps"></div></nav>
<main><div id="story"><h2 id="title"></h2><div id="path"></div><p id="narr"></p>
<div id="ctl"><button id="prev">Prev</button><button id="next">Next</button> <small>Arrow keys or j/k also work</small></div></div>
<pre id="code"></pre></main>
<script type="application/json" id="data">${safeJson(data)}</script>
<script>${CLIENT}</script></body></html>
`;
}
