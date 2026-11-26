import { PixelVox, type Ctx } from "./kit";

export const snow="#f4f5e9", frost="#c6e1e2", pine="#195241", leaf="#358360", red="#bb2838",
  berry="#822538", gold="#e8b655", butter="#ffe49c", wood="#855334", dark="#403638", cream="#fff0d6";
export const bulbs=[red,"#41b990",gold,"#87c8ea","#f88daa"];
const tau=Math.PI*2;
export { tau };

export function stroke(v:PixelVox, a:number[], b:number[], color:string, emit=0) {
  const d=Math.max(1,...a.map((n,i)=>Math.ceil(Math.abs(n-b[i]))));
  for(let i=0;i<=d;i++) v.put(a[0]+(b[0]-a[0])*i/d,a[1]+(b[1]-a[1])*i/d,a[2]+(b[2]-a[2])*i/d,color,emit);
}
export function star(v:PixelVox,x:number,y:number,z:number,r=2) {
  for(let i=-r;i<=r;i++) for(let j=-r;j<=r;j++) {
    if(i===0 || j===0 || Math.abs(i)+Math.abs(j)<=r-1) v.put(x+i,y+j,z,gold,0.65);
  }
  v.put(x,y,z+1,butter,0.8);
}
export function pad(c:Ctx, color=snow) {
  // A clipped-corner snow bank lets the island's ground show around each scene.
  for(let z=-c.hz+1;z<c.hz-1;z++) {
    const corner=Math.max(0,3-Math.min(z+c.hz-1,c.hz-2-z));
    c.v.box(-c.hx+1+corner,0,z,c.hx-1-corner,1,z+1,color);
  }
}
export function gift(v:PixelVox,x:number,y:number,z:number,s:number,color:string, ribbon=gold) {
  s=Math.max(2,Math.round(s));
  const mid=Math.floor(s/2);
  v.box(x,y,z,x+s,y+s,z+s,color).box(x+mid,y,z,x+mid+1,y+s+1,z+s,ribbon)
    .box(x,y+s-1,z+mid,x+s,y+s,z+mid+1,ribbon).box(x,y,z+mid,x+1,y+s,z+mid+1,ribbon)
    .put(x+mid-1,y+s,z+mid,ribbon).put(x+mid+1,y+s,z+mid,ribbon);
}
export function wreath(v:PixelVox,x:number,y:number,z:number,r:number) {
  for(let i=0;i<28;i++) v.put(x+r*Math.cos(i*tau/28),y+r*Math.sin(i*tau/28),z,i%7===0?red:leaf);
  v.put(x-1,y-r,z+1,red).put(x+1,y-r,z+1,red);
}
export function fir(v:PixelVox,x:number,y:number,z:number,r:number,h:number,style=0,trim=false) {
  v.cylinderY(x,z,y,y+h*0.45,Math.max(1,r*0.19),wood);
  const n=3+Math.floor(h/15), tier=h/(n+0.6);
  for(let i=0;i<n;i++) {
    const base=y+2+i*tier, end=base+tier*(i===n-1?1.45:1.8);
    const radius=r*(1-i/(n+0.4))*(style===1?0.8:1);
    v.cone(x,base,end,z,radius,0.6,i%2?leaf:pine);
    if(style===3) v.cone(x,base+tier*0.58,end,z,radius*0.68,0.5,snow);
    if(trim && radius>3)for(let j=0;j<8;j++){
      const a=j*tau/8+i*.38,px=x+radius*Math.cos(a),pz=z+radius*Math.sin(a);
      v.put(px,base-1,pz,style===3?snow:leaf);
    }
    if(trim) for(let j=0;j<Math.round(5+radius);j++) {
      const a=j*tau/Math.round(5+radius)+i*0.55;
      const px=x+(radius-0.4)*Math.cos(a), pz=z+(radius-0.4)*Math.sin(a);
      v.put(px,base,pz,bulbs[(i+j)%bulbs.length],0.8);
      if(style===1 && j%2===0) v.put(px,base+1,pz,butter,1);
    }
  }
  if(style===2) for(let j=0;j<h*5;j++) {
    const t=j/(h*5); const a=t*2.8*tau; const rad=(1-t)*r;
    v.put(x+rad*Math.cos(a),y+2+t*(h-1),z+rad*Math.sin(a),gold,0.25);
  }
  return Math.round(y+2+(n-1+1.45)*tier);
}
export function gable(v:PixelVox,x:number,z:number,w:number,d:number,eave:number,rise:number,color:string,edge?:string) {
  for(let i=-w;i<=w;i++) {
    const y=eave+Math.round(rise*(1-Math.abs(i)/w));
    v.box(x+i,y-1,z-d,x+i+1,y+1,z+d+1,color);
    if(edge) v.put(x+i,y,z+d,edge).put(x+i,y,z-d,edge);
  }
}
export function cabin(v:PixelVox,x:number,z:number,w:number,d:number,h:number,wall:string,roof:string,rise:number) {
  v.hollowBox(x-w+1,1,z-d+1,x+w,h+1,z+d,wall,wood);
  for(let i=-w+2;i<w;i+=4) v.box(x+i,3,z+d-1,x+i+2,5,z+d,butter,0.45);
  v.box(x-1,1,z+d-1,x+2,5,z+d,wood).put(x+1,2,z+d,gold);
  for(let i=-w+1;i<w;i++) v.box(x+i,h,z-d+1,x+i+1,h+1+Math.round(rise*(1-Math.abs(i)/w)),z+d,wall);
  gable(v,x,z,w,d,h+1,rise,roof,snow);
}
export function strand(v:PixelVox, x0:number,x1:number,y:number,z:number, sag=2) {
  for(let x=x0;x<=x1;x++){
    const t=(x-x0)/Math.max(1,x1-x0), yy=y-Math.round(4*t*(1-t)*sag);
    v.put(x,yy,z,pine);
    if((x-x0)%3===0)v.put(x,yy-1,z,bulbs[Math.floor((x-x0)/3)%bulbs.length],0.85);
  }
}
export function deer(v:PixelVox,x:number,y:number,z:number,coat=wood) {
  for(const dx of [-2,1])for(const dz of [-1,1])v.box(x+dx,y,z+dz,x+dx+1,y+3,z+dz+1,dark);
  v.box(x-3,y+3,z-1,x+2,y+5,z+2,coat).box(x+1,y+4,z-1,x+3,y+7,z+2,coat)
    .box(x+2,y+5,z-1,x+5,y+6,z+2,coat).put(x+4,y+5,z+1,red).put(x+2,y+6,z+1,dark);
  for(const dz of [-1,1]) {
    const p=z+dz;
    stroke(v,[x+1,y+6,p],[x-1,y+9,p+dz],gold);
    v.put(x+1,y+8,p+dz,gold);
  }
  v.put(x-3,y+5,z,cream);
}
export function person(v:PixelVox,x:number,y:number,z:number,robe:string,skin:string,hat?:string) {
  v.box(x-1,y,z-1,x+2,y+3,z+1,robe).box(x-1,y+3,z-1,x+1,y+5,z+1,skin);
  if(hat)v.box(x-1,y+5,z-1,x+1,y+6,z+1,hat);
}
export const santaSkin="#78442e", santaHighlight="#a86544";
export function blackSanta(v:PixelVox,x:number,y:number,z:number,scale=1) {
  // The front and both cheeks remain exposed above the moustache, even at the smallest scale.
  const block=(a:number,b:number,c:number,d:number,e:number,f:number,col:string)=>
    v.box(x+a*scale,y+b*scale,z+c*scale,x+d*scale,y+e*scale,z+f*scale,col);
  for(const dx of [-3,1]) block(dx,0,-1,dx+2,2,3,dark);
  block(-3,2,-2,3,7,2,red); block(-3,2,1,3,3,3,cream);
  block(-3,4,1,3,5,3,dark); block(-1,4,2,1,5,3,gold);
  block(-4,4,-1,-3,7,2,red);block(3,4,-1,4,7,2,red);
  block(-4,4,1,-3,5,3,cream);block(3,4,1,4,5,3,cream);
  block(-3,7,-2,3,12,2,santaSkin);block(-2,10,1,2,12,2,santaHighlight);
  block(-2,10,2,-1,11,3,dark);block(1,10,2,2,11,3,dark);
  block(0,9,2,1,10,3,santaHighlight);
  block(-3,7,-2,-2,9,2,cream);block(2,7,-2,3,9,2,cream);
  block(-2,7,1,2,8,3,snow);block(-1,6,1,1,7,3,cream);
  block(-1,8,2,0,9,3,snow);block(1,8,2,2,9,3,snow);
  block(-3,12,-2,3,13,2,cream);block(-3,13,-2,3,15,2,red);
  block(-1,15,-2,3,16,1,red);block(2,14,-1,4,15,1,red);block(3,13,-1,5,15,1,snow);
}
