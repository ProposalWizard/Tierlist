// make the packed page use Roboto for its body font, as an Android WebView does
const W=(globalThis.__REPO||process.cwd())+"/phone/tools/look/out/web/fonts/";
if (!globalThis.__rob) { globalThis.__rob = true;
await P.context().route("**/kibfonts/*", (route) => { const f = route.request().url().split("/").pop(); route.fulfill({ path: W + f, contentType: "font/ttf" }); });
const css = [["400","Roboto-400.ttf","normal"],["500","Roboto-500.ttf","normal"],["600","Roboto-700.ttf","normal"],["700","Roboto-700.ttf","normal"],["800","Roboto-800.ttf","normal"],["900","Roboto-900.ttf","normal"],["400","Roboto-400i.ttf","italic"],["700","Roboto-700i.ttf","italic"],["900","Roboto-900i.ttf","italic"]].map(([w,f,s])=>`@font-face{font-family:"KRoboto";src:url(/kibfonts/${f}) format("truetype");font-weight:${w};font-style:${s}}`).join("") + `html,body{font-family:"KRoboto",sans-serif !important}`;
await P.context().addInitScript((css) => { const put=()=>{ if(document.getElementById("kr")||!document.documentElement) return; const s=document.createElement("style"); s.id="kr"; s.textContent=css; (document.head||document.documentElement).appendChild(s); }; put(); document.addEventListener("DOMContentLoaded", put); }, css);
await P.evaluate((css)=>{ const s=document.createElement("style"); s.id="kr"; s.textContent=css; document.head.appendChild(s); }, css);
}
await wait(1500);
return await diff(30);
