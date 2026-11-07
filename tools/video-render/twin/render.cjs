// node render.cjs V            -> V/out.mp4 (1080x1920, 30 fps, H.264 + AAC)
// node render.cjs V stills 1,5.5  -> V/stills/t1.00.png ...
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/home/user/Tierlist/node_modules/playwright')}})();
const {spawn}=require('child_process');const fs=require('fs');const path=require('path');
const V=path.resolve(process.argv[2]); const mode=process.argv[3]||'video';
(async()=>{
  const tl=JSON.parse(fs.readFileSync(V+'/timeline.json')); const sc=JSON.parse(fs.readFileSync(V+'/scenes.json'));
  const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  pg.on('pageerror',e=>console.log('ERR',e.message)); pg.on('console',m=>console.log('PAGE',m.text()));
  await pg.goto('file://'+__dirname+'/video.html'); await pg.evaluate(a=>window.boot(a[0],a[1]),[tl,sc]);
  await pg.evaluate(()=>document.fonts.ready);
  if(mode==='stills'){ fs.mkdirSync(V+'/stills',{recursive:true});
    for(const t of process.argv[4].split(',').map(Number)){await pg.evaluate(t=>window.render(t),t);await pg.screenshot({path:`${V}/stills/t${t.toFixed(2)}.png`});}
  } else {
    const fps=30,N=Math.ceil(tl.total*fps);
    const ff=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-i',V+'/mix.wav',
      '-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-profile:v','high','-r','30',
      '-c:a','aac','-b:a','192k','-ar','48000','-shortest','-movflags','+faststart',V+'/out.mp4'],{stdio:['pipe','inherit','inherit']});
    for(let i=0;i<N;i++){ await pg.evaluate(t=>window.render(t),i/fps);
      const buf=await pg.screenshot({type:'jpeg',quality:92}); if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r));
      if(i%300===0) console.log('frame',i,'/',N); }
    ff.stdin.end(); await new Promise(r=>ff.on('close',r));
  }
  await b.close();
})();
