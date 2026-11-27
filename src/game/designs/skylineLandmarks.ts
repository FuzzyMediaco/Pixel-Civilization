import type { Ctx } from "./kit";
import { beam, entrance, facade, finish as f, loop, oval, plate, planter, slab, storey, TAU, type Point, type Point3 } from "./sculpturalKit";

// Even the first occupied crown rises above the previous 140-voxel skyscraper.
const megaStoreys = [26,31,36,41,46];
const floorPitch = 6;
function twistingSpire(c: Ctx,n: number) {
  const {v,hx,hz,lv}=c, rx=hx-3,rz=hz-3;
  let previous: Point[]=[];
  for(let i=0;i<n;i++){
    const t=i/(n-1), a=i*(0.053+0.002*lv), r=0.91-0.43*t+0.09*Math.cos(t*3*Math.PI);
    const y=1+i*floorPitch, crown=i>=n-4;
    const inner=oval(0,0,rx*r*0.88,rz*r*0.88,3,a);
    const outer=oval(0,0,rx*r,rz*r,3,a);
    storey(v,inner,outer,y,floorPitch,crown?"#53a3a9":"#326478",crown?f.gold:"#a1bec0");
    if(previous.length)outer.forEach(([x,z],j)=>beam(v,pointAt(previous[j],y-1),[x,y+floorPitch-1,z],f.porcelain,2));
    if(lv>=2 && i%9===5)for(const [x,z] of outer)planter(v,x*0.87,y+floorPitch,z*0.87);
    previous=outer;
  }
  const h=1+n*floorPitch;
  previous.forEach(p=>beam(v,pointAt(p,h),[0,h+6+lv*2,0],f.porcelain));
  c.blink(0,h+6+lv*2,0,"red");
}
function pointAt(p: Point, y: number): Point3 { return [p[0],y,p[1]]; }

function goldenEscarpment(c: Ctx,n: number) {
  const {v,hx,hz,lv}=c,rx=hx-3,rz=hz-3;
  for(let i=0;i<n;i++){
    const t=i/(n-1), y=1+floorPitch*i;
    const r=0.4+0.57*(1-t)**3+0.21*t**5, z=-rz*0.15*t;
    const outer=plate(0,z,rx*r,rz*r,0.3), inner=plate(0,z,rx*r-1,rz*r-1,0.3);
    storey(v,inner,outer,y,floorPitch,"#966638",i%4===0?f.porcelain:f.gold);
    // Swept buttresses taper into four dark reveals between the main facades.
    for(const s of [-1,1]){
      beam(v,[s*rx*r*0.67,y,z+rz*r],[s*rx*r*0.67,y+floorPitch-1,z+rz*r],f.copper,2);
      beam(v,[s*rx*r,y,z+rz*r*0.45],[s*rx*r,y+floorPitch-1,z+rz*r*0.45],f.bronze);
    }
    if(i===Math.floor(n*0.36)||(lv>=3&&i===Math.floor(n*0.7))){
      slab(v,oval(0,z,rx*(r+0.18),rz*(r+0.18),12),y+floorPitch-1,2,f.limestone);
      loop(v,oval(0,z,rx*(r+0.16),rz*(r+0.16),12),y+floorPitch+1,f.garden);
    }
  }
  const h=1+n*floorPitch;
  for(let y=0;y<5+lv;y++)slab(v,plate(0,-rz*0.15,rx*(0.51-y*0.025),rz*(0.51-y*0.025),0.4),h+y,1,y%3===0?f.gold:f.glass);
  c.blink(0,h+5+lv,-rz*0.15,"red");
}

function meridianGate(c: Ctx,n: number) {
  const {v,hx,hz,lv}=c,rx=hx-3,rz=hz-3;
  for(const side of [-1,1]){
    const count=n-(side>0?3:0);
    for(let i=0;i<count;i++){
      const t=i/(n-1), y=1+i*floorPitch;
      const x=side*rx*(0.44+0.22*Math.sin(Math.PI*t)-0.12*t), z=side*rz*0.16;
      const rx2=rx*(0.38-0.15*t),rz2=rz*(0.67-0.23*t);
      storey(v,plate(x,z,rx2-1,rz2-1,0.47),plate(x,z,rx2,rz2,0.47),y,floorPitch,"#31586a",i%3===0?f.copper:"#55788b");
      beam(v,[x-side*rx2,y,z+rz2*0.48],[x-side*rx2,y+floorPitch-1,z+rz2*0.48],f.porcelain,2);
    }
    const h=1+count*floorPitch;
    for(let k=0;k<5+lv;k++)slab(v,plate(side*rx*0.33,side*rz*0.16,Math.max(2,rx*0.2-k*0.26),Math.max(2,rz*0.42-k*0.5)),h+k,1,f.copper);
  }
  // Skybridges keep the long cut through the middle open all the way to the ground.
  for(let j=1;j<=(lv>=3?3:2);j++){
    const y=1+Math.floor(n*j/(lv>=3?4:3))*floorPitch;
    const span=rx*0.56;
    storey(v,plate(0,0,span,rz*0.19),plate(0,0,span,rz*0.23),y,5+lv,f.glass,f.gold);
    for(let i=-2;i<2;i++)beam(v,[span*i/2,y+(i%2===0?0:5),rz*0.21],[span*(i+1)/2,y+(i%2===0?5:0),rz*0.21],f.porcelain);
  }
  c.blink(-rx*0.33,1+n*floorPitch+5+lv,-rz*0.16,"red");
}

function orbitSpire(c: Ctx,n: number) {
  const {v,hx,hz,lv}=c,rx=hx-3,rz=hz-3;
  let prev: Point[]=[];
  for(let i=0;i<n;i++){
    const t=i/(n-1), y=1+floorPitch*i;
    // Three occupied sky clubs swell out of a continuous spindle, the highest an observatory.
    const bulb=(at:number,range:number)=>Math.max(0,1-((t-at)/range)**2)**0.72;
    const r=0.22+0.41*(1-t)**3+0.41*bulb(0.19,0.15)+0.44*bulb(0.52,0.16)+0.64*bulb(0.84,0.16);
    const p=oval(0,0,rx*r,rz*r,20), ribs=oval(0,0,rx*r,rz*r,8,Math.PI/8);
    storey(v,oval(0,0,rx*r-0.7,rz*r-0.7,20),p,y,floorPitch,t>0.72?"#386882":f.nightGlass,i%3===0?f.silver:"#487d91");
    if(prev.length)ribs.forEach((p,j)=>beam(v,pointAt(prev[j],y-1),pointAt(p,y+floorPitch-1),f.pearl));
    if(lv>=2 && i===Math.round(n*0.84))loop(v,oval(0,0,rx*r+1,rz*r+1),y+floorPitch,f.amber,0.65);
    prev=ribs;
  }
  const h=1+n*floorPitch;
  for(const p of prev)beam(v,pointAt(p,h),[0,h+lv*2+5,0],f.silver);
  c.blink(0,h+lv*2+5,0,"red");
}
export function megaSkyscraper(c: Ctx) {
  entrance(c,0,0,3+c.lv);
  [twistingSpire,goldenEscarpment,meridianGate,orbitSpire][c.variant](c,megaStoreys[c.lv-1]);
}

interface TreeSite { x: number; z: number; radius: number; height: number }
function supertree(c: Ctx, site: TreeSite, index: number) {
  const {v,lv,variant:s}=c, {x,z,radius:r,height:h}=site;
  const metal=["#83507a","#ad7349","#407b89","#76527f"][s], light=["#eb89ed","#ffcc78","#70e6dd","#bf9ffc"][s];
  const trunkH=Math.round(h*0.62), branches=8+lv+(s===1?3:0);
  const trunkR=Math.max(1.7,r*0.21);
  const bed=oval(x,z,Math.max(3,r*0.42),Math.max(3,r*0.39),18);
  slab(v,bed,0,1,"#788557"); loop(v,bed,1,"#ceaa87");
  for(let y=0;y<trunkH;y++){
    const width=trunkR*(1.0+0.45*(1-y/trunkH)**3+0.16*Math.cos(y/5));
    v.cylinderY(x,z,y,y+1,width,y%6===0?metal:"#3a785a");
    for(let k=0;k<3;k++){
      const a=y*0.15+TAU*k/3;
      v.put(x+width*Math.cos(a),y,z+width*Math.sin(a),y%7<3?"#99bb5d":"#4c9566",0.12);
      if(k===0 || y%4!==0)v.put(x+(width+0.15)*Math.cos(a+0.45),y,z+(width+0.15)*Math.sin(a+0.45),"#66b875",0.38);
    }
  }
  const rim: Point[]=[], lace: Point3[]=[];
  for(let k=0;k<branches;k++){
    const a=k*TAU/branches+index*0.46;
    const swept=s===3?0.7:s===1?0.26:0;
    const rad=r*(s===2?0.66+0.32*Math.abs(Math.cos(a)):s===1?0.88+0.12*Math.cos(3*a):0.94);
    const outerY=h+(s===2?Math.cos(a)*h*0.12:s===0?(k%2)*1.5:s===1?2*Math.cos(3*a):1.7*Math.sin(2*a));
    const root:Point3=[x+trunkR*Math.cos(a),trunkH-4,z+trunkR*Math.sin(a)];
    const knee:Point3=[x+r*0.42*Math.cos(a+swept*0.45),trunkH+0.5*(h-trunkH),z+r*0.42*Math.sin(a+swept*0.45)];
    const tip:Point3=[x+rad*Math.cos(a+swept),outerY,z+rad*Math.sin(a+swept)];
    beam(v,root,knee,k%3===0?"#55aba7":metal,1,k%3===0?0.32:0.09);
    const shoulder:Point3=[x+rad*0.67*Math.cos(a+swept*0.7),outerY-2.5,z+rad*0.67*Math.sin(a+swept*0.7)];
    beam(v,knee,shoulder,metal,1,0.15);beam(v,shoulder,tip,metal,1,0.2);
    lace.push(shoulder);
    for(const sign of [-1,1]){
      const az=a+swept+sign*TAU/(branches*2.7);
      const twig:Point3=[x+rad*1.01*Math.cos(az),outerY+1+(k+index)%2,z+rad*1.01*Math.sin(az)];
      beam(v,shoulder,twig,metal,1,0.18);
      v.put(...twig,k%3===0?"#f8dafa":light,0.65);
    }
    const fork:Point3=[x+0.87*rad*Math.cos(a+swept+TAU/branches*0.52),outerY-1,z+0.87*rad*Math.sin(a+swept+TAU/branches*0.52)];
    beam(v,knee,fork,k%2?metal:light,1,k%2?0:0.4);
    v.put(...tip,light,1.2);
    rim.push([knee[0],knee[2]]);
  }
  loop(v,rim,trunkH+0.5*(h-trunkH),light,0.5);
  lace.forEach((point,k)=>{
    if(k%4!==1 || s===3)beam(v,point,lace[(k+1)%lace.length],metal,1,0.18);
  });
  loop(v,oval(x,z,trunkR+0.5,trunkR+0.5,14),trunkH-2,"#7cdbb5",0.62);
  if(s===3||lv>=4)loop(v,oval(x,z,r*0.32,r*0.32,branches),trunkH+2,metal);
  const deckY=Math.round(h*0.47);
  slab(v,oval(x,z,trunkR+1.5,trunkR+1.5),deckY,1,f.cedar);
}
export function supertreeGrove(c: Ctx) {
  const {v,lv,variant:s,hx,hz}=c, radius=Math.min(hx,hz)-2;
  const layouts=[
    [[-0.24,-0.16],[0.53,0.32],[-0.59,0.46],[0.41,-0.58]],
    [[0,-0.43],[-0.48,0.27],[0.51,0.28],[0,0.65]],
    [[-0.43,-0.4],[0.34,-0.1],[0.55,0.57],[-0.45,0.53]],
    [[0.25,-0.31],[-0.51,-0.06],[0.19,0.58],[0.62,0.17]],
  ];
  const count=[1,2,2,3,4][lv-1], sites=layouts[s].slice(0,count).map(([a,b],i) => ({
    x:count===1?0:a*hx, z:count===1?0:b*hz, radius:radius*(count===1?0.91:i===0?0.57:0.37),
    height:(18+lv*5)*(i===0?1:i===1?0.78:i===2?0.64:0.53),
  }));
  for(const [i,site] of sites.entries()){
    supertree(c,site,i);
    if(i===0 || lv<3)continue;
    const from=sites[(s===2||s===3)?i-1:0];
    for(let step=0;step<=30;step++){
      const t=step/30, x=from.x+(site.x-from.x)*t, z=from.z+(site.z-from.z)*t;
      const y=(from.height+(site.height-from.height)*t)*0.47-1.5*Math.sin(Math.PI*t);
      v.box(x-1,y,z-1,x+2,y+1,z+2,f.cedar);
      for(const side of [-1,1])v.put(x,y+2,z+side,step%6===0?f.amber:f.gold,step%6===0?0.7:0);
    }
  }
  entrance(c,sites[0].x,sites[0].z,2);
}

// A gallery is lofted along a bent axis. Each transverse section has its own rise,
// lean and width, so the titanium sails curl above the glazed entrance.
function titaniumWing(c: Ctx, x: number,z: number, length: number, width: number, angle: number, high: number, lift: number, warm: boolean) {
  const {v}=c, reach=Math.ceil(length+width+4);
  const height=Math.ceil(high+lift+3);
  for(let y=1;y<=height;y++){
    const t=y/height;
    // Sections lean and turn as they rise. The tapered belly widens into an overhanging metal lip.
    const yaw=angle+(t-0.5)*0.36, co=Math.cos(yaw),si=Math.sin(yaw);
    const drift=width*(0.53*t*t-0.16);
    const cx=x-si*drift, cz=z+co*drift;
    for(let X=Math.max(-c.hx,Math.floor(cx-reach));X<Math.min(c.hx,cx+reach);X++){
      for(let Z=Math.max(-c.hz,Math.floor(cz-reach));Z<Math.min(c.hz,cz+reach);Z++){
        const u=((X-cx)*co+(Z-cz)*si)/(length*(0.82+0.18*t));
        if(Math.abs(u)>=1)continue;
        const bend=width*(0.58*u*u-0.24);
        const breadth=width*(0.65+0.4*t)*Math.max(0.08,(1-u*u)**0.58);
        const w=(-(X-cx)*si+(Z-cz)*co-bend)/breadth;
        if(Math.abs(w)>1)continue;
        // An upswept bow and dipping waist give each gallery a concave silhouette in elevation.
        const rim=lift+high*(0.54+0.37*(u+0.23)**2+0.14*u+0.14*(w+1)/2);
        const roof=rim+Math.max(0,1-w*w)*high*0.12;
        if(y>roof)continue;
        const seam=(Math.round(u*length)+Math.floor(y/3)*2)%10===0 && y%3===0;
        const top=y>roof-1.3;
        const silver=top?(warm?"#ead6b4":"#e2e5df"):w< -0.18?(warm?"#c6b59e":"#bdc8ce"):(warm?"#ae9c86":"#9eafba");
        v.put(X,y,Z,seam?(warm?"#b19e87":"#9aa9b0"):silver);
      }
    }
  }
}
export function guggenheimBilbao(c: Ctx) {
  const {v,lv,variant:s,hx,hz}=c,rx=hx-2,rz=hz-3;
  // Four site plans: long riverfront, radial bouquet, long bridge, and a plaza embracing a court.
  const schemes=[
    [[-0.39,0.06,0.6,0.34,-0.26,0.72],[0.17,-0.25,0.58,0.32,0.95,1.1],[0.48,0.05,0.43,0.25,-0.9,0.79],[-0.2,-0.4,0.47,0.25,-0.67,0.93],[0.3,0.4,0.51,0.19,-0.34,0.52]],
    [[-0.2,-0.03,0.64,0.26,-0.99,1.02],[0.19,-0.11,0.65,0.31,0.85,1.25],[-0.34,0.29,0.54,0.22,-0.19,0.68],[0.51,0.28,0.45,0.24,1.28,0.8],[0.01,-0.48,0.45,0.2,0.03,0.66]],
    [[-0.33,0.13,0.66,0.22,0.01,0.55],[0.27,-0.12,0.49,0.35,1.61,1.38],[0.53,0.2,0.4,0.22,-0.55,0.73],[-0.31,-0.33,0.49,0.26,-0.46,0.8],[0.12,0.39,0.57,0.15,-0.03,0.54]],
    [[-0.39,-0.08,0.52,0.26,1.32,0.9],[0.15,-0.36,0.63,0.29,0.1,1.14],[0.49,0.12,0.48,0.26,1.18,0.82],[-0.48,0.34,0.41,0.22,-0.57,0.68],[0.18,0.5,0.53,0.2,-0.45,0.57]],
  ];
  // The limestone embankment ties the long river gallery, entrance stair and pool together.
  const promenade=plate(0,rz*0.47,rx*0.94,rz*0.39,0.42);
  slab(v,promenade,0,1,"#d7c6a2");
  for(let x=-rx*0.73;x<rx*0.72;x+=4){
    const z=rz*(0.73-0.08*Math.cos(x/rx*Math.PI));
    v.box(x,1,z,x+3,2,z+1,"#bba782");
  }
  const rear=plate(0,-rz*0.27,rx*0.63,rz*0.38,0.12);
  slab(v,rear,0,4+lv,"#c9b58f");
  const atrium=oval(0,0,rx*0.25,rz*0.42,8,0.2), atriumH=5+lv*2;
  facade(v,atrium,1,atriumH,f.nightGlass,f.silver,3);
  slab(v,atrium,atriumH,1,f.glass,0.18);
  for(let j=-2;j<=2;j++)beam(v,[j*rx*0.08,atriumH,rz*0.17],[j*rx*0.08,atriumH,-rz*0.18],f.silver);
  schemes[s].slice(0,Math.min(5,lv+1)).forEach(([a,b,len,w,ang,h],i)=>
    titaniumWing(c,a*rx,b*rz,len*rx,w*rz,ang,h*(8+lv*2.4),i===1?lv:1,i===3||s===3&&i===0));
  // A suspended entrance canopy curls forward from the tall central sail.
  const canopyW=rx*0.32;
  for(let x=-Math.floor(canopyW);x<canopyW;x++){
    const u=x/canopyW, depth=rz*(0.36-0.13*u*u), rearZ=rz*0.08;
    const y=5+lv+Math.round(2.5*u*u);
    for(let z=Math.floor(rearZ);z<rearZ+depth;z++)
      v.put(x,y+Math.round((z-rearZ)/depth*1.6),z,x%6===0?f.silver:"#c4cace");
  }
  for(const side of [-1,1])beam(v,[side*canopyW*0.77,1,rz*0.31],[side*canopyW*0.9,8+lv,rz*0.32],f.ink);
  const front=rz*0.43;
  entrance(c,0,front,2+lv);
  for(let i=0;i<3;i++)v.box(-lv-1+i,i,front-i,lv+2-i,i+1,front+4-2*i,f.limestone);
  if(lv>=2){
    const p=oval(-rx*0.5,rz*0.53,rx*0.36,rz*0.2);
    slab(v,p,0,1,f.pool);
    loop(v,p,1,f.silver);
    slab(v,oval(-rx*0.5,rz*0.53,rx*0.26,rz*0.12),1,1,"#549294");
  }
  if(lv>=3){
    const x=rx*0.67,z=rz*0.61;
    planter(v,x,0,z,2);
    for(let k=0;k<5;k++){
      const a=TAU*k/5;
      beam(v,[x-4,3,z],[x-4+2*Math.cos(a),5+(k%2),z+2*Math.sin(a)],"#c87842");
    }
  }
}
