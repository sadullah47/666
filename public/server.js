'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=+process.env.PORT||3000,DIR=process.env.DATA_DIR||path.join(__dirname,'data'),FILE=path.join(DIR,'db.json'),PUB=path.join(__dirname,'public');
fs.mkdirSync(DIR,{recursive:true});
let db={secret:crypto.randomBytes(32).toString('hex'),users:{},msgs:[],reads:{}};
try{db=Object.assign(db,JSON.parse(fs.readFileSync(FILE,'utf8')))}catch(e){}
let timer=null;
function save(){if(timer)return;timer=setTimeout(()=>{timer=null;const t=FILE+'.tmp';fs.writeFileSync(t,JSON.stringify(db));fs.renameSync(t,FILE)},300)}
save();
const sign=s=>crypto.createHmac('sha256',db.secret).update(s).digest('base64url');
const token=uid=>{const p=Buffer.from(JSON.stringify({u:uid,e:Date.now()+30*864e5})).toString('base64url');return p+'.'+sign(p)};
function authUser(t){
  if(!t)return null;const[p,s]=t.split('.');if(!p||!s)return null;
  const a=Buffer.from(s),b=Buffer.from(sign(p));if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  try{const d=JSON.parse(Buffer.from(p,'base64url'));return d.e>Date.now()?db.users[d.u]||null:null}catch(e){return null}
}
const hash=(pw,salt)=>crypto.scryptSync(pw,salt,64).toString('hex');
const pub=u=>({id:u.id,name:u.name,email:u.email});
const hits={};setInterval(()=>{for(const k in hits)delete hits[k]},36e5).unref();
const limited=ip=>(hits[ip]=(hits[ip]||0)+1)>30;
const clients=new Map();
const push=uid=>(clients.get(uid)||new Set()).forEach(r=>r.write('data: 1\n\n'));
setInterval(()=>clients.forEach(s=>s.forEach(r=>r.write(': ping\n\n'))),25000).unref();
const json=(res,code,o)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
const body=req=>new Promise((ok,no)=>{let d='';req.on('data',c=>{d+=c;if(d.length>1e4){no(new Error('big'));req.destroy()}});req.on('end',()=>{try{ok(d?JSON.parse(d):{})}catch(e){no(e)}})});
const EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
async function api(req,res,p,url){
  const ip=(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket.remoteAddress;
  if(p==='/api/stream'){
    const u=authUser(url.searchParams.get('t'));if(!u)return json(res,401,{error:'Oturum geçersiz'});
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': ok\n\n');
    if(!clients.has(u.id))clients.set(u.id,new Set());clients.get(u.id).add(res);req.on('close',()=>clients.get(u.id).delete(res));return;
  }
  if(req.method!=='POST'&&p!=='/api/sync')return json(res,405,{error:'Yöntem desteklenmiyor'});
  if(p==='/api/register'||p==='/api/login'){
    if(limited(ip))return json(res,429,{error:'Çok fazla deneme, biraz bekle.'});
    const b=await body(req),email=String(b.email||'').trim().toLowerCase(),pw=String(b.password||'');
    const found=Object.values(db.users).find(x=>x.email===email);
    if(p==='/api/login'){
      if(!found||!crypto.timingSafeEqual(Buffer.from(hash(pw,found.salt)),Buffer.from(found.hash)))return json(res,401,{error:'E-posta veya şifre hatalı.'});
      return json(res,200,{token:token(found.id),me:pub(found)});
    }
    const name=String(b.name||'').trim().slice(0,40);
    if(!name)return json(res,400,{error:'Lütfen adını yaz.'});
    if(!EMAIL.test(email)||email.length>120)return json(res,400,{error:'Geçerli bir e-posta yaz.'});
    if(pw.length<8||pw.length>200)return json(res,400,{error:'Şifre en az 8 karakter olmalı.'});
    if(found)return json(res,409,{error:'Bu e-posta zaten kayıtlı.'});
    const salt=crypto.randomBytes(16).toString('hex'),u={id:'u'+crypto.randomBytes(6).toString('hex'),name,email,salt,hash:hash(pw,salt),ts:Date.now()};
    db.users[u.id]=u;save();return json(res,200,{token:token(u.id),me:pub(u)});
  }
  const me=authUser((req.headers.authorization||'').replace('Bearer ',''));
  if(!me)return json(res,401,{error:'Oturum geçersiz'});
  if(p==='/api/sync'){
    const mine=db.msgs.filter(m=>m.from===me.id||m.to===me.id).slice(-1000),ids=new Set([me.id]);
    mine.forEach(m=>{ids.add(m.from);ids.add(m.to)});
    const reads={};for(const k in db.reads){const[a,b]=k.split('>');if(a===me.id||b===me.id)reads[k]=db.reads[k]}
    return json(res,200,{me:pub(me),users:[...ids].map(i=>db.users[i]).filter(Boolean).map(pub),msgs:mine,reads});
  }
  const b=await body(req);
  if(p==='/api/find'){const e=String(b.email||'').trim().toLowerCase(),u=Object.values(db.users).find(x=>x.email===e);
    if(!u||u.id===me.id)return json(res,404,{error:'Bu e-posta ile kayıtlı kimse yok.'});return json(res,200,{user:pub(u)})}
  if(p==='/api/send'){const text=String(b.text||'').trim().slice(0,2000);
    if(!text||!db.users[b.to]||b.to===me.id)return json(res,400,{error:'Mesaj gönderilemedi.'});
    const m={id:crypto.randomBytes(6).toString('hex'),from:me.id,to:b.to,text,ts:Date.now()};
    db.msgs.push(m);save();push(b.to);push(me.id);return json(res,200,m)}
  if(p==='/api/read'){if(!db.users[b.of])return json(res,400,{error:'Geçersiz'});db.reads[me.id+'>'+b.of]=Date.now();save();push(b.of);return json(res,200,{ok:1})}
  if(p==='/api/name'){const n=String(b.name||'').trim().slice(0,40);if(!n)return json(res,400,{error:'Ad boş olamaz.'});me.name=n;save();return json(res,200,{me:pub(me)})}
  return json(res,404,{error:'Bulunamadı'});
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
function serve(res,p){
  let f=path.join(PUB,path.normalize(p));if(!f.startsWith(PUB)||!fs.existsSync(f)||!fs.statSync(f).isFile())f=path.join(PUB,'index.html');
  const ext=path.extname(f);
  res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':ext==='.png'?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});
  fs.createReadStream(f).pipe(res);
}
http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://x');if(url.pathname.startsWith('/api/'))await api(req,res,url.pathname,url);else serve(res,url.pathname)}
  catch(e){if(!res.headersSent)json(res,500,{error:'Sunucu hatası'})}
}).listen(PORT,()=>console.log('Sohbet çalışıyor: http://localhost:'+PORT));
