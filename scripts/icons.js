// Render the app's geometric flower icon to PNG, with no build dependencies.
import { deflateSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
function crc32(bytes) {
  let crc=0xffffffff;
  for (const byte of bytes) { crc^=byte; for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
  return (crc^0xffffffff)>>>0;
}
function chunk(type, data) {
  const tag=Buffer.from(type), length=Buffer.alloc(4), crc=Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));
  return Buffer.concat([length,tag,data,crc]);
}
for (const size of [180,192,512]) {
  const raw=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++) {
    const row=y*(size*4+1); raw[row]=0;
    for(let x=0;x<size;x++) {
      const sums=[0,0,0];
      for(const dy of [.25,.75]) for(const dx of [.25,.75]) {
        const px=(x+dx)*192/size, py=(y+dy)*192/size;
        let c=[255,242,189];
        const ellipse=(cx,cy,rx,ry)=>((px-cx)/rx)**2+((py-cy)/ry)**2<=1;
        if(ellipse(96,67,18,34)||ellipse(96,125,18,34)||ellipse(67,96,34,18)||ellipse(125,96,34,18)) c=[186,219,242];
        if(ellipse(96,96,17,17)) c=[244,189,210];
        c.forEach((v,i)=>sums[i]+=v);
      }
      const index=row+1+x*4; sums.forEach((v,i)=>raw[index+i]=Math.round(v/4));raw[index+3]=255;
    }
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  await writeFile(`icon-${size}.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
