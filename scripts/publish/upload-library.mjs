import { readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
// SPACE=kib puts the video in the team's Cloudflare library; football (default) and content go in Mikey's own storage.
const site="https://knowitball.co.uk", headers={"Content-Type":"application/json","x-publish-agent":process.env.PUBLISH_AGENT_TOKEN};
const list=JSON.parse(readFileSync(process.argv[2],"utf8")), out=process.argv[3];
const done=existsSync(out)?JSON.parse(readFileSync(out,"utf8")):{};
for (const [id,path] of list){ if(done[id]) continue;
  const size=statSync(path).size; const name=id+"-"+path.split("/").pop();
  const r=await fetch(site+"/api/admin/publish/upload",{method:"POST",headers,body:JSON.stringify({name,size,space:process.env.SPACE||"football"})}); const up=await r.json();
  if(!r.ok){console.log("FAIL",id,up.error);continue}
  const put=await fetch(up.url,{method:"PUT",body:readFileSync(path),headers:{"content-length":String(size)}});
  if(!put.ok){console.log("PUTFAIL",id,put.status);continue}
  done[id]=up.key; writeFileSync(out,JSON.stringify(done,null,1)); console.log("ok",id,(size/1e6).toFixed(1)+"MB");
}
console.log("total",Object.keys(done).length);
