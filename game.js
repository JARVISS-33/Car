import * as THREE from 'three';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],R=Math.random,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
 
/* ---------- data + session save (sessionStorage only, no database) ---------- */
const CARS=[
{id:'street',name:'Street GT',price:0,color:0x1fb98c,acc:16,top:48,grip:7},
{id:'sport',name:'Apex RS',price:1500,color:0xe63946,acc:20,top:58,grip:8},
{id:'hyper',name:'Phantom X',price:4000,color:0x1c1c22,acc:26,top:70,grip:9}];
const UPG=[{k:'engine',n:'Engine',d:'More acceleration and top speed'},{k:'nitro',n:'Nitro',d:'Stronger boost'},{k:'tires',n:'Tires',d:'More grip'},{k:'armor',n:'Armor',d:'Less crash damage'}];
const MISSIONS=[
{id:1,name:'Morning Commute',type:'dist',goal:1500,time:75,dens:.5,reward:300},
{id:2,name:'Rush Hour',type:'over',goal:25,time:80,dens:.8,reward:600},
{id:3,name:'Needle Threader',type:'near',goal:12,time:90,dens:1,reward:900},
{id:4,name:'Night Run',type:'dist',goal:4000,time:110,dens:1.2,reward:1500}];
const GL={dist:'DISTANCE (m)',over:'OVERTAKES',near:'NEAR MISSES'};
const ACH={win:'First Victory',near:'Daredevil – 8 near misses in one run',fast:'Speed Demon – reach 200 km/h',garage:'Collector – own 2 cars',rich:'Tycoon – 5000 coins'};
let S=JSON.parse(sessionStorage.getItem('od3d')||'null')||{coins:0,owned:['street'],car:'street',up:{engine:0,nitro:0,tires:0,armor:0},done:[],ach:[],set:{sound:true,cam:0}};
const save=()=>sessionStorage.setItem('od3d',JSON.stringify(S)),car=()=>CARS.find(c=>c.id===S.car);
const unlock=k=>{if(!S.ach.includes(k)){S.ach.push(k);save();toast('🏆 '+ACH[k])}};
 
/* ---------- renderer + scene ---------- */
const renderer=new THREE.WebGLRenderer({canvas:$('#c'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
const scene=new THREE.Scene(),SKY=0x8ec5e8;scene.background=new THREE.Color(SKY);scene.fog=new THREE.Fog(SKY,80,420);
const cam=new THREE.PerspectiveCamera(65,1,.1,900);
scene.add(new THREE.HemisphereLight(0xffffff,0x4a6a40,1.9));const sun=new THREE.DirectionalLight(0xfff2d0,2.2);sun.position.set(-40,80,30);scene.add(sun);
const resize=()=>{renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()};addEventListener('resize',resize);resize();
const M=(c,r=.8,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const box=(w,h,d,mat,x=0,y=0,z=0,p)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);p&&p.add(m);return m};
 
/* ---------- world: endless highway made of recycled chunks ---------- */
const LANES=[-5.25,-1.75,1.75,5.25],WALL=7.7,RAD=.95,CH=100,NCH=8;
const asph=M(.18*0+0x2e3238,.95),yel=M(0xf2c230),wht=M(0xeeeeee),rail=M(0xaab4ba,.4,.6),grass=M(0x4f7a3a,1),trunk=M(0x5a3d22),leaf=M(0x2f6b2f),rock=M(0x7d8a8f,1),CG=new THREE.ConeGeometry(1.8,5,7);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(900,900),grass);ground.rotation.x=-Math.PI/2;ground.position.y=-.2;scene.add(ground);
const chunks=[];
for(let i=0;i<NCH;i++){const g=new THREE.Group();
box(15.6,.2,CH,asph,0,-.1,0,g);box(.15,.02,CH,yel,-.15,.02,0,g);box(.15,.02,CH,yel,.15,.02,0,g);
for(const s of[-1,1]){box(.18,.02,CH,wht,s*7.2,.02,0,g);box(.35,.9,CH,rail,s*7.9,.45,0,g);for(let d=-45;d<50;d+=10)box(.16,.02,4,wht,s*3.5,.02,d,g)}
for(let k=0;k<14;k++){const t=new THREE.Group(),s=R()<.5?-1:1;box(.5,2.4,.5,trunk,0,1.2,0,t);const c=new THREE.Mesh(CG,leaf);c.position.y=4.4;t.add(c);t.position.set(s*(11+R()*35),0,(R()-.5)*CH);g.add(t)}
for(let k=0;k<3;k++){const s=R()<.5?-1:1,h=10+R()*35;box(8+R()*6,h,8+R()*6,M(0x8d9aa5+(R()*0x303030|0),.9),s*(18+R()*30),h/2,(R()-.5)*CH,g)}
for(let k=0;k<2;k++){const s=k?1:-1,h=40+R()*50,c=new THREE.Mesh(new THREE.ConeGeometry(30+R()*20,h,6),R()<.5?rock:leaf);c.position.set(s*(100+R()*70),h/2,(R()-.5)*CH);g.add(c)}
g.position.z=50-i*CH;scene.add(g);chunks.push(g)}
const archMat=new THREE.MeshStandardMaterial({color:0x00e5ff,emissive:0x00e5ff,emissiveIntensity:.8}),arch=new THREE.Group();
box(.7,7,.7,archMat,-7.4,3.5,0,arch);box(.7,7,.7,archMat,7.4,3.5,0,arch);box(15.5,.9,.9,archMat,0,7,0,arch);arch.visible=false;scene.add(arch);
 
/* ---------- cars ---------- */
const WG=new THREE.CylinderGeometry(.38,.38,.28,14).rotateZ(Math.PI/2),TM=M(0x111111,.9),PAL=[0xe63946,0x457b9d,0xf1c40f,0xecf0f1,0x8e44ad,0xe67e22,0x2ecc71,0x34495e];
function mkCar(k,col){const g=new THREE.Group(),b=M(col,.3,.6),dk=M(0x0f161e,.2,.5),hl=M(0xfff3c0),u=g.userData;
u.tailMat=new THREE.MeshStandardMaterial({color:0x660000,emissive:0xff1010,emissiveIntensity:.3});u.wheels=[];
let L=4.4,W=1.9;
if(k==='car'){box(W,.6,L,b,0,.6,0,g);box(1.55,.5,2.1,dk,0,1.12,.2,g)}
else if(k==='truck'){L=9.5;W=2.5;box(2.3,2.3,2.4,b,0,1.45,-3.5,g);box(2.5,2.9,6.6,M(0xdfe3e6),0,1.95,1.3,g)}
else{L=11;W=2.5;box(W,3,L,b,0,2,0,g);box(W+.04,.9,L-1.2,dk,0,2.7,0,g)}
for(const s of[-1,1]){box(.5,.18,.06,hl,s*.65,.7,-L/2,g);box(.5,.18,.06,u.tailMat,s*.65,.7,L/2,g)}
for(const z of[-L*.33,L*.33])for(const s of[-1,1]){const w=new THREE.Mesh(WG,TM);w.position.set(s*(W/2-.05),.38,z);g.add(w);u.wheels.push(w)}
u.L=L;u.W=W;return g}
 
/* ---------- state ---------- */
const P={x:LANES[1],z:0,h:0,vx:0,vz:0,sp:0,steer:0,hp:100,nitro:100,cool:0,nOn:false,mesh:null};
const traffic=[],obst=[];let state='menu',run=null,cur=null,obNext=-250,camH=0,shake=0,fov=65,tm=0;
const resetP=()=>Object.assign(P,{x:LANES[1],z:0,h:0,vx:0,vz:0,sp:0,steer:0,hp:100,nitro:100,cool:0,nOn:false});
function buildPlayer(){if(P.mesh)scene.remove(P.mesh);const m=mkCar('car',car().color),fm=new THREE.MeshBasicMaterial({color:0xffa030});
m.userData.fl=[-.55,.55].map(x=>{const f=new THREE.Mesh(new THREE.ConeGeometry(.17,1.6,8),fm);f.rotation.x=Math.PI/2;f.position.set(x,.5,3.1);f.visible=false;m.add(f);return f});
P.mesh=m;m.position.set(P.x,0,P.z);scene.add(m)}
function clearWorld(){for(const t of traffic)scene.remove(t.mesh);for(const o of obst)scene.remove(o.mesh);traffic.length=obst.length=0;resetP();P.mesh.position.set(P.x,0,P.z);P.mesh.rotation.set(0,0,0);P.mesh.visible=true;arch.visible=false}
 
/* ---------- input ---------- */
const K=new Set(),key=(...c)=>c.some(x=>K.has(x));
addEventListener('keydown',e=>{K.add(e.code);if(e.code==='KeyC'){S.set.cam=(S.set.cam+1)%3;$('#sCam').value=S.set.cam;save();toast('Camera: '+['Chase','Hood','Far chase'][S.set.cam])}
if(e.code==='KeyR')resetCar();if(e.code==='Escape'||e.code==='KeyP')pause();if(e.code.startsWith('Arrow')||e.code==='Space')e.preventDefault()});
addEventListener('keyup',e=>K.delete(e.code));
$$('[data-k]').forEach(b=>{const c=b.dataset.k;b.addEventListener('pointerdown',e=>{e.preventDefault();K.add(c)});['pointerup','pointerleave','pointercancel'].forEach(v=>b.addEventListener(v,()=>K.delete(c)))});
 
/* ---------- audio ---------- */
let AC,eng,egain;
function initAudio(){if(AC)return;try{AC=new AudioContext();eng=AC.createOscillator();eng.type='sawtooth';egain=AC.createGain();egain.gain.value=0;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=700;eng.connect(f);f.connect(egain);egain.connect(AC.destination);eng.start()}catch(e){}}
function sfx(f,d,t='square',v=.12){if(!AC||!S.set.sound)return;const o=AC.createOscillator(),g=AC.createGain();o.type=t;o.frequency.value=f;g.gain.setValueAtTime(v,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+d);o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+d)}
function noise(d,v){if(!AC||!S.set.sound)return;const n=AC.sampleRate*d|0,b=AC.createBuffer(1,n,AC.sampleRate),a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=(R()*2-1)*(1-i/n);const s=AC.createBufferSource(),g=AC.createGain();g.gain.value=v;s.buffer=b;s.connect(g);g.connect(AC.destination);s.start()}
 
/* ---------- particles ---------- */
const PT=[];for(let i=0;i<70;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),new THREE.MeshBasicMaterial({color:0xffffff}));m.visible=false;scene.add(m);PT.push({m,l:0,L:1,vx:0,vy:0,vz:0,s:1})}
let pi=0;
function emit(x,y,z,col,n,sp,life=.5,size=1){for(let i=0;i<n;i++){const p=PT[pi++%PT.length];p.m.material.color.setHex(col);p.m.position.set(x,y,z);p.vx=(R()-.5)*sp;p.vy=R()*sp*.6;p.vz=(R()-.5)*sp;p.l=p.L=life;p.s=size;p.m.visible=true}}
 
/* ---------- vehicle physics ---------- */
function drive(dt){
const C=car(),U=S.up,top0=C.top*(1+.04*U.engine),acc0=C.acc*(1+.1*U.engine),grip0=C.grip*(1+.08*U.tires);
const gas=key('KeyW','ArrowUp'),brk=key('KeyS','ArrowDown'),tl=key('KeyA','ArrowLeft'),tr=key('KeyD','ArrowRight'),hb=key('ShiftLeft','ShiftRight');
const nOn=key('Space')&&gas&&P.nitro>0;P.nOn=nOn;P.cool-=dt;
P.steer+=cl((tl?1:0)-(tr?1:0)-P.steer,-5*dt,5*dt);
let sp=P.vx*-Math.sin(P.h)+P.vz*-Math.cos(P.h);
P.h+=P.steer*(.62/(1+Math.abs(sp)/22))*cl(sp/6,-1,1)*(hb?1.5:1)*1.8*dt;   // steering authority falls with speed
const fx=-Math.sin(P.h),fz=-Math.cos(P.h),rx=Math.cos(P.h),rz=-Math.sin(P.h);
sp=P.vx*fx+P.vz*fz;let lat=P.vx*rx+P.vz*rz;                                 // split velocity: forward / sideways
const top=top0*(nOn?1.3:1);
if(brk){if(sp>.5)sp-=34*dt;else sp=Math.max(sp-acc0*.5*dt,-12)}            // brake, then reverse gear
else if(gas)sp+=(acc0*Math.max(0,1-Math.max(sp,0)/top)+(nOn?10+2.5*U.nitro:0))*dt;
else sp-=sp*.12*dt+Math.sign(sp)*.6*dt;
if(sp>top)sp-=(sp-top)*2*dt;
lat*=Math.exp(-grip0*(hb?.12:1)*dt);if(hb)sp*=1-.25*dt;                      // tire grip; handbrake = drift
P.vx=fx*sp+rx*lat;P.vz=fz*sp+rz*lat;P.sp=sp;
P.nitro=nOn?Math.max(0,P.nitro-28*dt):Math.min(100,P.nitro+5*dt);
P.x+=P.vx*dt;P.z+=P.vz*dt;
collide();
if(Math.abs(lat)>3&&Math.abs(sp)>12){run.score+=dt*30;if(R()<.5)emit(P.x-fx*1.6+rx*(R()<.5?-.9:.9),.3,P.z-fz*1.6,0xcccccc,1,2,.6,1.6)}
const m=P.mesh;m.position.set(P.x,0,P.z);m.rotation.y=P.h;m.rotation.z=-P.steer*Math.min(Math.abs(sp),50)*.0015;
for(const w of m.userData.wheels)w.rotation.x-=sp*dt/.38;
m.userData.tailMat.emissiveIntensity=brk?2.5:.3;
m.userData.fl.forEach(f=>{f.visible=nOn;f.scale.y=.7+R()*.6});
if(nOn)shake=Math.max(shake,.05)}
 
/* solid collisions: 3 circles along the car vs walls, barriers and traffic (no passing through) */
function collide(){
const fx=-Math.sin(P.h),fz=-Math.cos(P.h),rc=[];
for(const o of obst)if(Math.abs(o.z-P.z)<12)rc.push({x:o.x,z:o.z,hw:o.hw,hd:o.hd,vz:0});
for(const t of traffic)if(Math.abs(t.z-P.z)<14)rc.push({x:t.x,z:t.z,hw:t.W/2,hd:t.L/2,vz:-t.v,t});
for(const off of[-1.45,0,1.45]){
  const cx=P.x+fx*off,cz=P.z+fz*off,hs=[];
  if(cx+RAD>WALL)hs.push({nx:-1,nz:0,pen:cx+RAD-WALL,vz:0});
  if(cx-RAD<-WALL)hs.push({nx:1,nz:0,pen:-WALL-cx+RAD,vz:0});
  for(const r of rc){let dx=cx-cl(cx,r.x-r.hw,r.x+r.hw),dz=cz-cl(cz,r.z-r.hd,r.z+r.hd);const d=Math.hypot(dx,dz);
   if(d<RAD){if(d<1e-4){dx=cx<r.x?-1:1;dz=0}else{dx/=d;dz/=d}hs.push({nx:dx,nz:dz,pen:RAD-d,vz:r.vz,t:r.t})}}
  for(const h of hs){P.x+=h.nx*h.pen;P.z+=h.nz*h.pen;
   const vn=P.vx*h.nx+(P.vz-h.vz)*h.nz;
   if(vn<0){P.vx-=1.25*vn*h.nx;P.vz-=1.25*vn*h.nz;P.vx*=.99;
    const im=-vn;
    if(im>3&&P.cool<=0){P.cool=.25;P.hp-=im*(h.t?2.2:2.6)*(1-.1*S.up.armor);shake=cl(im*.05,.15,1);run.hits++;
     noise(.35,cl(im/25,.1,.6));sfx(80,.2,'sawtooth',.2);emit(cx-h.nx*RAD,.6,cz-h.nz*RAD,0xffc040,10,8,.45,1);
     if(h.t)h.t.hit=true;if(im>12)toast('BIG CRASH!')}
    if(h.t)h.t.v=Math.max(0,h.t.v+h.nz*im*.4)}}}}
 
/* ---------- traffic AI + obstacles ---------- */
const densNow=()=>cl(run.m.dens+(-P.z)/8000,0,2);
const laneBlocked=(l,z,rg)=>obst.some(o=>o.lane===l&&o.z<z&&z-o.z<rg);
const occ=(l,z,s)=>traffic.some(o=>o!==s&&Math.abs(o.z-z)<(o.L+s.L)/2+10&&Math.abs(o.x-LANES[l])<2.4);
function spawnT(z){const lane=R()*4|0,p=R(),k=p<.72?'car':p<.88?'truck':'bus',x=LANES[lane],L=k==='car'?4.4:k==='truck'?9.5:11;
if(traffic.some(o=>Math.abs(o.z-z)<L+o.L&&Math.abs(o.x-x)<2.4)||obst.some(o=>o.lane===lane&&Math.abs(o.z-z)<80))return;
const m=mkCar(k,PAL[R()*8|0]),u=m.userData,base=(k==='car'?12+R()*10:k==='truck'?9+R()*4:8+R()*4)*(1+cl(-P.z/25000,0,.4));
m.position.set(x,0,z);scene.add(m);traffic.push({mesh:m,x,z,v:base,base,lane,L:u.L,W:u.W,cd:R()*8,hit:false,passed:false,minLat:99})}
function spawnOb(z){const l=R()*4|0,ls=[l];if(R()<.35&&l<3)ls.push(l+1);
for(const k of ls){const g=new THREE.Group();box(3.3,1,1.6,M(0xc9ccd0),0,.5,0,g);box(3.32,.28,1.62,M(0xff7a1a),0,.62,0,g);g.position.set(LANES[k],0,z);scene.add(g);obst.push({mesh:g,x:LANES[k],z,hw:1.65,hd:.8,lane:k})}}
function updTraffic(dt){const dens=densNow();
for(let i=traffic.length-1;i>=0;i--){const t=traffic[i];t.cd-=dt;
  if(laneBlocked(t.lane,t.z,60)){let b=-1;for(let l=0;l<4;l++)if(!laneBlocked(l,t.z,80)&&!occ(l,t.z,t)&&(b<0||Math.abs(l-t.lane)<Math.abs(b-t.lane)))b=l;if(b>=0)t.lane=b}
  else if(t.cd<=0){t.cd=5+R()*9;const l=t.lane+(R()<.5?-1:1);if(R()<.4*dens&&l>=0&&l<4&&!occ(l,t.z,t)&&!laneBlocked(l,t.z,70))t.lane=l}
  let tv=t.base;
  for(const o of traffic)if(o!==t&&Math.abs(o.x-t.x)<2.4&&o.z<t.z){const gap=t.z-o.z-(t.L+o.L)/2;if(gap<20)tv=Math.min(tv,Math.max(0,o.v-1+gap*.1))}
  for(const o of obst)if(o.lane===t.lane&&o.z<t.z&&t.z-o.z<22)tv=0;
  t.v=Math.max(0,t.v+cl(tv-t.v,-14*dt,5*dt));t.x+=cl(LANES[t.lane]-t.x,-2.2*dt,2.2*dt);t.z-=t.v*dt;
  t.mesh.position.set(t.x,0,t.z);t.mesh.rotation.y=-(LANES[t.lane]-t.x)*.06;
  const dz=t.z-P.z;if(Math.abs(dz)<5)t.minLat=Math.min(t.minLat,Math.abs(t.x-P.x)-t.W/2-.95);
  if(!t.passed&&dz>3){t.passed=true;if(!t.hit){run.over++;run.score+=50;if(t.minLat<.9){run.near++;run.score+=100;P.nitro=Math.min(100,P.nitro+12);toast('NEAR MISS! +100');sfx(990,.15,'sine')}}}
  if(t.z>P.z+60||t.z<P.z-480){scene.remove(t.mesh);traffic.splice(i,1)}}
for(let i=obst.length-1;i>=0;i--)if(obst[i].z>P.z+40){scene.remove(obst[i].mesh);obst.splice(i,1)}}
function spawn(){const dens=densNow();let c=0;for(const t of traffic)if(t.z<P.z)c++;if(c<Math.round(8+12*dens))spawnT(P.z-430-R()*20);
while(obNext>P.z-420){spawnOb(obNext);obNext-=(140+R()*140)/(.8+dens*.5)}}
 
/* ---------- camera ---------- */
function updCam(dt){const m=S.set.cam,k=1-Math.exp(-5*dt);camH=m===1?P.h:camH+(P.h-camH)*k;
const fx=-Math.sin(camH),fz=-Math.cos(camH),b=[8,-.1,13][m],h=[3.2,1.3,5.6][m],lk=[16,30,22][m];
cam.position.set(P.x-fx*b,h,P.z-fz*b);shake*=Math.exp(-5*dt);cam.position.x+=(R()-.5)*shake;cam.position.y+=(R()-.5)*shake;
cam.lookAt(P.x+fx*lk,1.2,P.z+fz*lk);
fov+=(62+cl(Math.abs(P.sp)/50,0,1.3)*14+(P.nOn?8:0)-fov)*k;cam.fov=fov;cam.updateProjectionMatrix();P.mesh.visible=m!==1}
function menuCam(){const a=tm*.25;cam.position.set(P.x+Math.sin(a)*7,2.2,P.z+Math.cos(a)*7);cam.lookAt(P.x,.8,P.z);cam.fov=55;cam.updateProjectionMatrix()}
 
/* ---------- game flow ---------- */
function start(m){buildPlayer();clearWorld();cur=m;
run={m,time:m.time,over:0,near:0,score:0,nextCP:500,cd:3,hits:0};arch.visible=true;arch.position.z=-500;obNext=-250;
for(let i=0;i<26;i++)spawnT(-130-R()*300);camH=0;state='play';show(null);$('#hud').classList.remove('hidden');$('#center').textContent='3';toast(m.name)}
function finish(win,why){const m=run.m;state='result';P.mesh.visible=true;sfx(win?660:120,.5,win?'sine':'sawtooth',.2);
const earn=(run.score/10|0)+(win?(S.done.includes(m.id)?m.reward*.3|0:m.reward):0);S.coins+=earn;
if(win&&!S.done.includes(m.id))S.done.push(m.id);if(win)unlock('win');if(run.near>=8)unlock('near');if(S.coins>=5000)unlock('rich');save();
$('#rT').textContent=win?'MISSION COMPLETE':'MISSION FAILED';$('#rW').textContent=why;
$('#rS').innerHTML=[['Distance',((-P.z)|0)+' m'],['Overtakes',run.over],['Near misses',run.near],['Crashes',run.hits],['Score',run.score|0],['Coins earned','+'+earn]].map(([a,b])=>`<div class="item"><span>${a}</span><b>${b}</b></div>`).join('');
$('#hud').classList.add('hidden');$('#center').textContent='';renderUI();show('result')}
function pause(){if(state==='play'){state='pause';show('pause')}else if(state==='pause'){state='play';show(null)}}
function resetCar(){if(state!=='play')return;let b=0;for(let l=1;l<4;l++)if(Math.abs(LANES[l]-P.x)<Math.abs(LANES[b]-P.x))b=l;P.x=LANES[b];P.h=0;P.vx=P.vz=0;P.z+=6;camH=0;toast('Car recovered')}
function step(dt){
if(run.cd>0){run.cd-=dt;$('#center').textContent=run.cd>0?Math.ceil(run.cd):'GO!';if(run.cd<=0)setTimeout(()=>$('#center').textContent='',700);updCam(dt);return}
drive(dt/2);drive(dt/2);updTraffic(dt);spawn();
run.time-=dt;run.score+=Math.max(0,P.sp)*dt*.2;
const dist=-P.z;
if(dist>=run.nextCP){run.time+=15;run.nextCP+=500;arch.position.z=-run.nextCP;toast('CHECKPOINT +15s');sfx(880,.25,'sine')}
const m=run.m,prog={dist,over:run.over,near:run.near}[m.type];
if(prog>=m.goal)return finish(true,'Goal reached!');
if(P.hp<=0)return finish(false,'Your car was destroyed');
if(run.time<=0)return finish(false,"Time's up");
hud(prog);updCam(dt)}
function hud(prog){const kmh=Math.abs(P.sp)*3.6|0;
$('#hSp').textContent=kmh;$('#dial').style.setProperty('--p',cl(kmh/280*100,0,100));$('#wheel').style.transform=`rotate(${-P.steer*100}deg)`;
$('#hHp').style.width=cl(P.hp,0,100)+'%';$('#hN').style.width=P.nitro+'%';$('#hT').textContent=Math.ceil(run.time);$('#hS').textContent=run.score|0;
$('#hGoal').style.width=cl(prog/run.m.goal*100,0,100)+'%';$('#hGoalL').textContent=GL[run.m.type];$('#hGoalT').textContent=(prog|0)+' / '+run.m.goal;
$('#hStat').textContent=`Overtakes ${run.over} · Near ${run.near} · ${(-P.z)|0} m`;if(kmh>=200)unlock('fast')}
function updFX(dt){
for(const p of PT)if(p.l>0){p.l-=dt;p.vy-=9*dt;p.m.position.x+=p.vx*dt;p.m.position.y=Math.max(0,p.m.position.y+p.vy*dt);p.m.position.z+=p.vz*dt;p.m.scale.setScalar(Math.max(.01,p.s*p.l/p.L));if(p.l<=0)p.m.visible=false}
if(AC){eng.frequency.setTargetAtTime(50+Math.abs(P.sp)*3.6*.8+(P.nOn?30:0),AC.currentTime,.08);egain.gain.setTargetAtTime(S.set.sound&&state==='play'?.06:0,AC.currentTime,.1)}
if(state==='play'&&P.hp<35&&R()<.3)emit(P.x-Math.sin(P.h)*1.2,1,P.z-Math.cos(P.h)*1.2,0x555555,1,1.5,.9,2)}
let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.05);last=now;tm+=dt;
for(const c of chunks)while(c.position.z>P.z+CH*1.5)c.position.z-=NCH*CH;ground.position.z=P.z;
if(state==='play')step(dt);else if(state!=='pause')menuCam();
updFX(dt);renderer.render(scene,cam)}
 
/* ---------- UI ---------- */
function show(id){$$('.screen').forEach(e=>e.classList.toggle('hidden',e.id!==id))}
let tt;function toast(s){const e=$('#toast');e.textContent=s;e.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('show'),1800)}
function renderUI(){
$$('.coins b').forEach(e=>e.textContent=S.coins);
$('#mList').innerHTML=MISSIONS.map(m=>`<div class="item"><div><b>${m.name}</b><small>${{dist:'Reach '+m.goal+' m',over:'Overtake '+m.goal+' cars',near:m.goal+' near misses'}[m.type]} · ${m.time}s · reward ${m.reward}</small></div><button data-m="${m.id}">${S.done.includes(m.id)?'REPLAY ✓':'START'}</button></div>`).join('');
$('#gList').innerHTML=CARS.map(c=>`<div class="item"><div><b>${c.name}</b><small>Power ${c.acc} · Top ${c.top*3.6|0} km/h</small></div><button data-car="${c.id}">${S.car===c.id?'SELECTED':S.owned.includes(c.id)?'SELECT':'BUY '+c.price}</button></div>`).join('');
$('#uList').innerHTML=UPG.map(u=>{const l=S.up[u.k];return `<div class="item"><div><b>${u.n} Lv ${l}</b><small>${u.d}</small></div><button data-up="${u.k}">${l>=5?'MAX':'UPGRADE '+200*(l+1)}</button></div>`}).join('');
$('#achL').innerHTML=Object.entries(ACH).map(([k,v])=>`<div class="item"><b>${S.ach.includes(k)?'🏆':'🔒'} ${v}</b></div>`).join('')}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;initAudio();const d=b.dataset;
if(d.go){clearWorld();state='menu';$('#hud').classList.add('hidden');show(d.go);renderUI()}
else if(d.m)start(MISSIONS.find(m=>m.id==d.m));
else if(d.car){const c=CARS.find(c=>c.id===d.car);
  if(S.owned.includes(c.id))S.car=c.id;else if(S.coins>=c.price){S.coins-=c.price;S.owned.push(c.id);S.car=c.id;toast('Purchased '+c.name);unlock('garage')}else toast('Not enough coins');
  save();buildPlayer();renderUI()}
else if(d.up){const l=S.up[d.up],p=200*(l+1);if(l<5&&S.coins>=p){S.coins-=p;S.up[d.up]++;save();toast('Upgraded!')}else toast(l>=5?'Already maxed':'Not enough coins');renderUI()}
else if(d.act==='retry')start(cur);
else if(d.act==='pause'||d.act==='resume')pause();
else if(d.act==='quit'){clearWorld();state='menu';$('#hud').classList.add('hidden');show('menu')}});
$('#sSound').checked=S.set.sound;$('#sCam').value=S.set.cam;
$('#sSound').onchange=e=>{S.set.sound=e.target.checked;save()};$('#sCam').onchange=e=>{S.set.cam=+e.target.value;save()};
 
/* ---------- boot ---------- */
buildPlayer();renderUI();show('menu');requestAnimationFrame(loop);
