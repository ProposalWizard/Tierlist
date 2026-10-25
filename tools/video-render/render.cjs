const {chromium}=require('/home/user/Tierlist/node_modules/playwright');
const {spawn}=require('child_process');const fs=require('fs');
const V=process.argv[2]; const mode=process.argv[3]||'video';
(async()=>{
  const tl=JSON.parse(fs.readFileSync(V+'/timeline.json'));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--disable-gpu']});
  const pg=await b.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  pg.on('console',m=>console.log('PAGE',m.text())); pg.on('pageerror',e=>console.log('ERR',e.message));
  await pg.goto('file://'+V+'/video.html'); await pg.evaluate(t=>window.boot(t),tl);
  if(mode==='frames'){
    const a=+process.argv[4],bb=+process.argv[5];
    for(let i=a;i<bb;i++){await pg.evaluate(t=>window.render(t),i/30);await pg.screenshot({type:'jpeg',quality:94,path:`${V}/frames/f${String(i).padStart(5,'0')}.jpg`});}
  } else if(mode==='stills'){
    const ts=process.argv[4].split(',').map(Number);
    for(const t of ts){await pg.evaluate(t=>window.render(t),t);await pg.screenshot({path:`${process.env.SD}/t${t.toFixed(2)}.png`});}
  } else {
    const fps=30,N=Math.ceil(tl.total*fps);
    const ff=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-i',V+'/mix.wav',
      '-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-profile:v','high','-r','30',
      '-c:a','aac','-b:a','192k','-ar','48000','-shortest','-movflags','+faststart',V+'/out.mp4'],{stdio:['pipe','inherit','inherit']});
    for(let i=0;i<N;i++){
      await pg.evaluate(t=>window.render(t),i/fps);
      const buf=await pg.screenshot({type:'jpeg',quality:93});
      if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r));
      if(i%150===0) console.log('frame',i,'/',N);
    }
    ff.stdin.end(); await new Promise(r=>ff.on('close',r));
  }
  await b.close();
})();
