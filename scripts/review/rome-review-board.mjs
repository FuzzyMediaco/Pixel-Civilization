// Run after rome-worlds.mjs images. Share the sheet separately from the answer key.
import fs from "node:fs";
import path from "node:path";
import {createCanvas,loadImage} from "@napi-rs/canvas";
const dir=path.resolve("docs/review/rome-pilot");
const order=[
  ["A","rome-aqueduct","skyline"],["B","original","street"],["C","rome-forum","skyline"],
  ["D","rome-forum","street"],["E","rome-aqueduct","street"],["F","original","skyline"],
];
const sheet=createCanvas(1200,542),ctx=sheet.getContext("2d");
ctx.fillStyle="#f6f5ed";ctx.fillRect(0,0,sheet.width,sheet.height);
for (const [i,[label,era,view]] of order.entries()) {
  const img=await loadImage(path.join(dir,era+"-"+view+".webp"));
  const x=6+(i%3)*400,y=4+Math.floor(i/3)*270;
  ctx.fillStyle="#25382c";ctx.font="bold 18px Arial";ctx.fillText(label,x,y+18);
  ctx.drawImage(img,x,y+24,388,236);
}
fs.writeFileSync(path.join(dir,"review-board.webp"),sheet.encodeSync("webp",90));
fs.writeFileSync(path.join(dir,"review-key.json"),JSON.stringify(Object.fromEntries(order.map(([label,era,view])=>[label,{era,view}])),null,2)+"\n");
