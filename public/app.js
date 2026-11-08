'use strict';
const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const COL=['#0B7A5E','#5B4B9E','#B4472B','#2F6690','#8A5A00','#7A3E65','#456B2E'];
const ini=n=>(n||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toLocaleUpperCase('tr');
const col=n=>{let h=0;for(const ch of n||'')h=(h*31+ch.charCodeAt(0))%997;return COL[h%COL.length]};
const tm=ts=>new Date(ts).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
const fmt=ts=>new Date(ts).toDateString()===new Date().toDateString()?tm(ts):new Date(ts).toLocaleDateString('tr-TR',{day:'numeric',month:'short'});
const day=ts=>{const d=new Date(ts),n=new Date();if(d.toDateString()===n.toDateString())return'Bugün';if(d.toDateString()===new Date(n-864e5).toDateString())return'Dün';return d.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'})};
const avatar=n=>{const a=el('div','av',ini(n));a.style.background=col(n);return a};
const setTheme=t=>{try{localStorage.setItem('theme',t)}catch(e){}t==='auto'?document.documentElement.removeAttribute('data-theme'):document.documentElement.setAttribute('data-theme',t)};
let T=null,me=null,U={},M=[],RD={},cur=null,tab='chats',extra={},es=null,seen=0,defer=null;
try{T=localStorage.getItem('tok');const th=localStorage.getItem('theme');if(th&&th!=='auto')setTheme(th)}catch(e){}
const api=(p,b)=>fetch('/api/'+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+T},body:b?JSON.stringify(b):undefined})
  .then(r=>r.json().then(j=>{if(r.status===401&&T&&p!=='login')logout();if(!r.ok)throw new Error(j.error||'Bir hata oluştu');return j}));
function logout(){try{localStorage.removeItem('tok')}catch(e){}T=null;me=null;cur=null;M=[];extra={};seen=0;if(es)es.close();authScreen(false)}
function card(t,p){const A=$('#app');A.textContent='';A.className='';A.style.cssText='display:flex;height:100%';const c=el('div','card');c.appendChild(el('h1',null,t));if(p)c.appendChild(el('p',null,p));A.appendChild(c);return c}
function inp(ph,t,ac){const i=el('input','fld');i.type=t;i.placeholder=ph;i.autocomplete=ac;i.required=true;i.setAttribute('aria-label',ph);return i}
function authScreen(reg){
  const c=card(reg?'Hesap oluştur':'Giriş yap',reg?'Ad, e-posta ve şifre yeterli.':'Hesabınla devam et.');
  const n=reg?inp('Adın','text','name'):null,e=inp('E-posta','email','email'),pw=inp('Şifre (en az 8 karakter)','password',reg?'new-password':'current-password');
  const er=el('div','note');er.style.padding='0';const b=el('button','pri',reg?'Kayıt ol':'Giriş yap');b.type='submit';
  const f=el('form');f.style.cssText='display:flex;flex-direction:column;gap:12px';[n,e,pw,er,b].forEach(x=>x&&f.appendChild(x));
  f.onsubmit=ev=>{ev.preventDefault();b.disabled=true;er.textContent='';
    api(reg?'register':'login',{name:n&&n.value,email:e.value,password:pw.value}).then(r=>{T=r.token;try{localStorage.setItem('tok',T)}catch(x){}me=r.me;start()}).catch(x=>{b.disabled=false;er.textContent=x.message})};
  c.appendChild(f);const s=el('button','lnk',reg?'Zaten hesabın var mı? Giriş yap':'Hesabın yok mu? Kayıt ol');s.type='button';s.onclick=()=>authScreen(!reg);c.appendChild(s)}
function start(){
  const A=$('#app');A.textContent='';A.style.cssText='';A.className='app';
  A.innerHTML='<aside><div class="top"><h1>Sohbet</h1></div><form class="nw" id="nw"><label style="flex:1;display:flex"><span style="position:absolute;left:-9999px">E-posta</span><input class="srch" id="em" type="email" placeholder="Arkadaşının e-postası" autocomplete="off"></label><button class="pri" type="submit">Başlat</button></form><div class="note" id="note"></div><div class="list" id="list"></div><div class="tabs" id="tabs"><button class="tab on" data-t="chats" type="button">Sohbetler</button><button class="tab" data-t="settings" type="button">Ayarlar</button></div></aside><main id="main"></main>';
  $('#nw').onsubmit=ev=>{ev.preventDefault();const v=$('#em').value.trim();if(!v)return;
    api('find',{email:v}).then(r=>{$('#note').textContent='';$('#em').value='';extra[r.user.id]=r.user;U[r.user.id]=r.user;open(r.user.id)}).catch(x=>{$('#note').textContent=x.message+' Arkadaşından önce kayıt olmasını iste.'})};
  $('#tabs').onclick=ev=>{const b=ev.target.closest('.tab');if(!b)return;tab=b.dataset.t;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===b));renderList()};
  if(es)es.close();es=new EventSource('/api/stream?t='+T);es.onmessage=refresh;
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&T)refresh()});
  refresh();renderMain()}
async function refresh(){
  try{const d=await api('sync');me=d.me;U={};d.users.forEach(u=>U[u.id]=u);for(const k in extra)U[k]=U[k]||extra[k];M=d.msgs;RD=d.reads;
    if(cur&&unread(cur))markRead(cur);
    const n=M.filter(m=>m.from!==me.id).length;
    if(seen&&n>seen&&document.hidden&&window.Notification&&Notification.permission==='granted'){const l=M[M.length-1];new Notification(U[l.from]?U[l.from].name:'Sohbet',{body:l.text})}
    seen=n;renderList();if(cur)renderMsgs()}catch(e){}}
const peer=m=>m.from===me.id?m.to:m.from;
const unread=p=>{const r=RD[me.id+'>'+p]||0;return M.filter(m=>m.from===p&&m.ts>r).length};
function markRead(p){RD[me.id+'>'+p]=Date.now();api('read',{of:p}).catch(()=>{})}
function renderList(){
  const L=$('#list');if(!L)return;L.textContent='';$('#nw').style.display=tab==='chats'?'':'none';
  let nu=0;new Set(M.map(peer)).forEach(p=>nu+=p===cur?0:unread(p));document.title=(nu?'('+nu+') ':'')+'Sohbet';
  tab==='chats'?renderChats(L):renderSettings(L)}
function renderChats(L){
  const last={};M.forEach(m=>last[peer(m)]=m);Object.keys(extra).forEach(k=>{if(!last[k])last[k]=null});
  const ps=Object.keys(last).sort((a,b)=>(last[b]?last[b].ts:Infinity)-(last[a]?last[a].ts:Infinity));
  if(!ps.length)L.appendChild(el('div','empty','Henüz sohbet yok. Yukarıya arkadaşının e-postasını yazıp başlat.'));
  ps.forEach(p=>{const u=U[p]||{name:'Bilinmiyor'},l=last[p],b=el('button','row'+(p===cur?' on':''));b.type='button';b.appendChild(avatar(u.name));
    const m=el('div','mid');m.appendChild(el('div','nm',u.name));m.appendChild(el('div','pv',l?(l.from===me.id?'Sen: ':'')+l.text:'Sohbeti başlat'));b.appendChild(m);
    const r=el('div','rt'),n=p===cur?0:unread(p);if(l)r.appendChild(el('span',null,fmt(l.ts)));if(n){r.className='rt u';r.appendChild(el('span','bd',String(n)))}
    b.appendChild(r);b.onclick=()=>open(p);L.appendChild(b)})}
function open(p){cur=p;if(unread(p))markRead(p);$('#app').classList.add('open');renderMain();renderList()}
function renderMain(){
  const X=$('#main');X.textContent='';
  if(!cur){const e=el('div','empty');e.appendChild(el('b',null,'Sohbet'));e.appendChild(el('div',null,'Bir sohbet seç ya da e-posta ile yeni sohbet başlat.'));X.appendChild(e);return}
  const u=U[cur]||{name:'Bilinmiyor',email:''},h=el('div','hd'),bk=el('button','back');bk.type='button';bk.setAttribute('aria-label','Geri');
  bk.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  bk.onclick=()=>{cur=null;$('#app').classList.remove('open');renderMain();renderList()};h.appendChild(bk);h.appendChild(avatar(u.name));
  const m=el('div','mid');m.appendChild(el('div','nm',u.name));m.appendChild(el('div','pv',u.email||''));h.appendChild(m);X.appendChild(h);
  const box=el('div','msgs');box.id='msgs';X.appendChild(box);
  const f=el('form','cmp'),lb=el('label');lb.style.cssText='flex:1;display:flex';const sp=el('span',null,'Mesaj yaz');sp.style.cssText='position:absolute;left:-9999px';
  const i=el('input');i.placeholder='Mesaj yaz';i.autocomplete='off';i.maxLength=2000;lb.appendChild(sp);lb.appendChild(i);f.appendChild(lb);
  const sb=el('button','snd');sb.type='submit';sb.setAttribute('aria-label','Gönder');sb.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 20l18-8L3 4v6l11 2-11 2z"/></svg>';f.appendChild(sb);
  f.onsubmit=ev=>{ev.preventDefault();const v=i.value.trim();if(!v)return;i.value='';
    api('send',{to:cur,text:v}).then(r=>{if(!M.some(x=>x.id===r.id))M.push(r);renderMsgs();renderList()}).catch(x=>{i.value=v;$('#note').textContent=x.message})};
  X.appendChild(f);renderMsgs();if(matchMedia('(min-width:761px)').matches)i.focus()}
function renderMsgs(){
  const B=$('#msgs');if(!B)return;B.textContent='';const rd=RD[cur+'>'+me.id]||0;let pd='';
  M.filter(m=>peer(m)===cur).forEach(x=>{const dl=day(x.ts);if(dl!==pd){B.appendChild(el('div','day',dl));pd=dl}
    const o=x.from===me.id,b=el('div','m '+(o?'out':'in'));b.appendChild(el('span',null,x.text));b.appendChild(el('span','t',tm(x.ts)+(o?(x.ts<=rd?' ✓✓ okundu':' ✓ gönderildi'):'')));B.appendChild(b)});
  B.scrollTop=B.scrollHeight}
const sec=t=>el('div','sec',t);
function renderSettings(L){
  const r=el('div','row');r.appendChild(avatar(me.name));const m=el('div','mid');m.appendChild(el('div','nm',me.name));m.appendChild(el('div','pv',me.email));r.appendChild(m);L.appendChild(r);
  L.appendChild(sec('Adını değiştir'));
  const f=el('form','nw'),i=el('input','srch');i.value=me.name;i.maxLength=40;i.setAttribute('aria-label','Adın');const b=el('button','pri','Kaydet');b.type='submit';f.appendChild(i);f.appendChild(b);
  f.onsubmit=ev=>{ev.preventDefault();api('name',{name:i.value}).then(x=>{me=x.me;U[me.id]=me;renderList()}).catch(()=>{})};L.appendChild(f);
  L.appendChild(sec('Görünüm'));const sg=el('div','seg');let cu='auto';try{cu=localStorage.getItem('theme')||'auto'}catch(e){}
  [['auto','Otomatik'],['light','Açık'],['dark','Koyu']].forEach(p=>{const x=el('button',p[0]===cu?'on':'',p[1]);x.type='button';x.onclick=()=>{setTheme(p[0]);[...sg.children].forEach(y=>y.className=y===x?'on':'')};sg.appendChild(x)});L.appendChild(sg);
  const sa=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  if(!sa){L.appendChild(sec('Telefona uygulama olarak ekle'));
    if(defer){const d=el('button','pri','Uygulamayı yükle');d.style.cssText='margin:4px 20px;width:calc(100% - 40px)';d.type='button';d.onclick=()=>{defer.prompt();defer=null};L.appendChild(d)}
    const n=el('div','inst');n.innerHTML='<p><b>iPhone (Safari):</b> Paylaş düğmesi, sonra <b>Ana Ekrana Ekle</b>.</p><p><b>Android (Chrome):</b> ⋮ menüsü, sonra <b>Uygulamayı yükle</b> ya da <b>Ana ekrana ekle</b>.</p>';L.appendChild(n)}
  if(window.Notification&&Notification.permission==='default'){L.appendChild(sec('Bildirimler'));const nb=el('button','pri','Bildirimleri aç');nb.type='button';nb.style.cssText='margin:4px 20px;width:calc(100% - 40px)';nb.onclick=()=>Notification.requestPermission().then(renderList);L.appendChild(nb)}
  const lo=el('button','lnk','Çıkış yap');lo.type='button';lo.style.cssText='margin:12px 8px;color:var(--err)';lo.onclick=logout;L.appendChild(lo)}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();defer=e;if(me&&tab==='settings')renderList()});
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
if(T)api('sync').then(d=>{me=d.me;start()}).catch(e=>e instanceof TypeError?card('Bağlantı yok','İnternete bağlanınca sayfayı yenile.'):authScreen(false));else authScreen(false);
