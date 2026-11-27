import type { Ctx, PixelVox } from "./kit";

export type Point = [number, number];
export type Point3 = [number, number, number];
export const TAU = Math.PI * 2;

export const finish = {
  porcelain: "#f6eedd", limestone: "#d8bf91", silver: "#b4c6ce", pearl: "#e4eaf0",
  glass: "#347682", nightGlass: "#233e57", pool: "#45c3bd", copper: "#b66a48",
  bronze: "#a77743", gold: "#edc57b", cedar: "#a36041", ink: "#283749",
  garden: "#428165", leaf: "#78aa57", soil: "#715548", amber: "#ffcf83",
};

export function oval(x: number, z: number, rx: number, rz: number, sides = 24, turn = 0): Point[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = turn + i * TAU / sides;
    return [x + rx * Math.cos(a), z + rz * Math.sin(a)];
  });
}

/** A clipped rectangular floor plate. Rotation happens before stretching to the parcel. */
export function plate(x: number, z: number, rx: number, rz: number, bevel = 0.25, turn = 0): Point[] {
  const k = 1 - bevel, co = Math.cos(turn), si = Math.sin(turn);
  return [[-k,-1],[k,-1],[1,-k],[1,k],[k,1],[-k,1],[-1,k],[-1,-k]].map(([a,b]) =>
    [x + rx * (a * co - b * si), z + rz * (a * si + b * co)]);
}

interface Span { z: number; left: number; right: number }
/** Scan-convert a convex plan at voxel centers. The right endpoint is exclusive. */
function spans(plan: Point[]): Span[] {
  const z0 = Math.ceil(Math.min(...plan.map(p => p[1])) - 0.5);
  const z1 = Math.ceil(Math.max(...plan.map(p => p[1])) - 0.5);
  const rows: Span[] = [];
  for (let z = z0; z < z1; z++) {
    const h = z + 0.5;
    let left = Infinity, right = -Infinity;
    for (let i = 0; i < plan.length; i++) {
      const [a,b] = plan[i], [c,d] = plan[(i + 1) % plan.length];
      if ((b <= h && h < d) || (d <= h && h < b)) {
        const hit = a + (c - a) * (h - b) / (d - b);
        left = Math.min(left, hit); right = Math.max(right, hit);
      }
    }
    rows.push({z, left: Math.ceil(left - 0.5), right: Math.ceil(right - 0.5)});
  }
  return rows;
}

export function slab(v: PixelVox, plan: Point[], y: number, thick: number, color: string, glow = 0) {
  for (const {z,left,right} of spans(plan)) {
    if (right > left) v.box(left, y, z, right, y + thick, z + 1, color, glow);
  }
}

/** A hollow curtain wall. Only its outer faces are stored, including along diagonals. */
export function facade(v: PixelVox, plan: Point[], y: number, height: number, glass: string, frame: string, spacing = 5) {
  const rows = spans(plan);
  for (let i = 0; i < rows.length; i++) {
    const {z,left,right} = rows[i], prev = rows[i - 1], next = rows[i + 1];
    for (let x = left; x < right; x++) {
      if (x > left && x < right - 1 && prev && next && x >= prev.left && x < prev.right && x >= next.left && x < next.right) continue;
      const side = x === left || x === right-1;
      const bay = side ? z : x;
      const mullion = bay % spacing === 0;
      v.box(x,y,z,x+1,y+height,z+1,mullion ? frame : glass,mullion ? 0 : 0.08);
      if (!mullion && height >= 4 && (Math.floor(bay/spacing)*3 + Math.floor(y/4)*5) % 13 === 0) {
        v.put(x,y+1,z,"#cfa875",0.4);
      }
    }
  }
}

export function storey(v: PixelVox, plan: Point[], eaves: Point[], y: number, height: number, glass: string, rim: string) {
  facade(v,plan,y,height,glass,finish.ink);
  slab(v,eaves,y+height-1,1,rim);
}

/** Voxel line for inclined struts, roof seams, light strings and branching canopies. */
export function beam(v: PixelVox, a: Point3, b: Point3, color: string, width = 1, glow = 0) {
  const delta = b.map((n,i) => n-a[i]);
  const steps = Math.max(1,Math.ceil(Math.max(...delta.map(Math.abs)) * 1.6));
  for (let i = 0; i <= steps; i++) {
    const t = i/steps, x = Math.round(a[0]+t*delta[0]), y = Math.round(a[1]+t*delta[1]), z = Math.round(a[2]+t*delta[2]);
    if (width === 1) v.put(x,y,z,color,glow);
    else v.box(x,y,z,x+width,y+width,z+width,color,glow);
  }
}

export function loop(v: PixelVox, plan: Point[], y: number, color: string, glow = 0) {
  plan.forEach(([x,z],i) => {
    const [X,Z] = plan[(i+1)%plan.length];
    beam(v,[x,y,z],[X,y,Z],color,1,glow);
  });
}

export function planter(v: PixelVox, x: number, y: number, z: number, size = 1) {
  x = Math.round(x); z = Math.round(z);
  v.box(x-1,y,z-1,x+2,y+1,z+2,finish.bronze);
  v.box(x,y+1,z,x+1,y+2+size,z+1,finish.cedar);
  v.cylinderY(x+0.5,z+0.5,y+1+size,y+2+size,size+0.45,finish.garden);
  v.cylinderY(x+0.5,z+0.5,y+2+size,y+3+size,Math.max(0.7,size-0.35),finish.leaf);
}

/** An apron ends at the front door and leaves the rest of the terrain visible. */
export function entrance(c: Ctx, x: number, z: number, halfWidth: number, color = finish.limestone) {
  c.v.box(x-halfWidth,0,z,x+halfWidth+1,1,c.hz,color);
}

/** Public-facing street shops with recessed glazing, independent canopies and sign strips. */
export function shops(v: PixelVox, left: number, right: number, front: number, colors: string[]) {
  const x0=Math.ceil(left), x1=Math.floor(right), count=Math.max(1,Math.floor((x1-x0)/6));
  const width=(x1-x0)/count;
  for(let i=0;i<count;i++){
    const x=Math.round(x0+i*width), end=Math.round(x0+(i+1)*width);
    v.box(x,1,front,end,5,front+1,finish.nightGlass,0.12);
    v.box(x,1,front,x+1,5,front+1,finish.cedar);
    v.box(x,4,front,end,5,front+2,colors[i%colors.length]);
    v.put(x+1,3,front+1,finish.amber,0.55);
  }
}
