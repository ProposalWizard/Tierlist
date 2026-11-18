const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const S=process.argv[2];const d=JSON.parse(fs.readFileSync(S+'/v02f/scenes.json'));const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1080,height:1920}});
 pg.on('pageerror',e=>console.log('ERR',e.message));await pg.goto('file://'+S+'/full/full.html');await pg.evaluate(d=>window.go(d),d);
 const R=d.lists.top.rows, sk=d.scenes.saka.aside, pops=k=>d.scenes[k].pop; const pal=R[2], fir=R[3];
 const shots=[
  ['A1-saka','poster',{...sk,rankText:'#31',line:'Not even top 30',pop:pops('saka'),shown:[1,2,7,8,6],cap:["YOU'D","THINK","SAKA?"],capHi:2}],
  ['A2-firmino','poster',{...fir,rankText:'#4',pop:pops('c4'),shown:[1,2,7,8,6,5,4],cap:['FOUR:','ROBERTO','FIRMINO.'],capHi:2}],
  ['A3-palmer','poster',{...pal,rankText:'#3',line:"Salah's statistical twin",twin:true,pop:pops('c3'),shown:[1,2,3,4,5,6,7,8],cap:['SALAH\'S','STATISTICAL','TWIN.'],capHi:2}],
  ['B1-intro','split',{blur:true,face:pal.face,label:'HIS TWIN IS...',cap:['WHO','IS','HIS','TWIN?'],capHi:3}],
  ['B2-saka','split',{...sk,rankText:'#31 · NOT TOP 30',cap:["HE'S","31ST."],capHi:1}],
  ['B3-palmer','split',{...pal,rankText:'#3 · THE TWIN',twin:true,line:'His first season at Chelsea',cap:['COLE','PALMER.'],capHi:1}]];
 for(const [n,fn,p] of shots){await pg.evaluate(([fn,p])=>window[fn](p),[fn,p]);await pg.screenshot({path:`${S}/full/${n}.png`});}
 await b.close();})();
