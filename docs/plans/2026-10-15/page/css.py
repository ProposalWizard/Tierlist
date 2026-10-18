CSS = r'''
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>Knowitball Plans</title>
<style>
  :root{
    --bg:#0b100e;--card:#141d18;--card2:#192520;--line:#24332b;
    --ink:#f2f7f4;--ink2:#9fb6aa;--ink3:#6f8679;
    --green:#3ddc84;--amber:#f5b942;--red:#ff6b6b;--blue:#6fb8ff;--violet:#b18cff;
    --onacc:#06170e;--r:12px;color-scheme:dark;
  }
  @media (prefers-color-scheme: light){
    :root:not([data-theme="dark"]){
      --bg:#f4f7f5;--card:#fff;--card2:#eef3f0;--line:#dae4de;
      --ink:#0e1613;--ink2:#4a6157;--ink3:#5d7469;
      --green:#0f9d58;--amber:#a8730a;--red:#c62828;--blue:#1565c0;--violet:#6a3fc0;
      --onacc:#fff;color-scheme:light;
    }
  }
  :root[data-theme="light"]{
    --bg:#f4f7f5;--card:#fff;--card2:#eef3f0;--line:#dae4de;
    --ink:#0e1613;--ink2:#4a6157;--ink3:#5d7469;
    --green:#0f9d58;--amber:#a8730a;--red:#c62828;--blue:#1565c0;--violet:#6a3fc0;
    --onacc:#fff;color-scheme:light;
  }
  :root[data-theme="dark"]{
    --bg:#0b100e;--card:#141d18;--card2:#192520;--line:#24332b;
    --ink:#f2f7f4;--ink2:#9fb6aa;--ink3:#6f8679;
    --green:#3ddc84;--amber:#f5b942;--red:#ff6b6b;--blue:#6fb8ff;--violet:#b18cff;
    --onacc:#06170e;color-scheme:dark;
  }
  *{box-sizing:border-box}
  [hidden]{display:none!important}
  html{overflow-x:hidden}
  html,body{margin:0;padding:0;max-width:100%}
  body{background:var(--bg);color:var(--ink);
    font:15.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased}
  .wrap{max-width:760px;margin:0 auto;padding-block:0 70px;
    padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
  header{padding:34px 0 4px}
  .ver{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.12em;
    background:var(--green);color:var(--onacc);padding:4px 10px;border-radius:999px}
  h1{font-size:clamp(28px,7.5vw,40px);line-height:1.05;margin:12px 0 8px;letter-spacing:-.025em}
  .sub{color:var(--ink3);font-size:13.5px;margin:0 0 18px}
  h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;
    margin:40px 0 12px;display:flex;align-items:center;flex-wrap:wrap;gap:9px}
  h2 i{width:9px;height:9px;border-radius:50%;flex:0 0 auto;font-style:normal}
  .fix i{background:var(--green)} .fix{color:var(--green)}
  .add i{background:var(--blue)} .add{color:var(--blue)}
  .chg i{background:var(--violet)} .chg{color:var(--violet)}
  .bug i{background:var(--amber)} .bug{color:var(--amber)}
  .nxt i{background:var(--ink3)} .nxt{color:var(--ink3)}
  h3.sh{font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);font-weight:800;margin:26px 0 8px}
  h4{font-size:13px;margin:14px 0 6px;color:var(--ink)}
  .hd{font-weight:700;color:var(--ink)}
  .dt{color:var(--ink2);font-size:14px;margin-top:3px}
  .dt b{color:var(--ink)}
  p{margin:0 0 9px}
  .nav{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 20px}
  .nav a{font-size:12px;font-weight:700;padding:6px 11px;border-radius:999px;background:var(--card);border:1px solid var(--line);color:var(--ink2);text-decoration:none}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;margin:0 0 8px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px;min-width:0}
  .card h3{margin:0 0 4px;font-size:16px;letter-spacing:-.01em;display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
  .card h3 a{color:var(--ink);text-decoration:none}
  .card .one{color:var(--ink2);font-size:13.5px;margin:0 0 9px}
  .kv{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px solid var(--line);font-size:13px}
  .kv span{color:var(--ink2)} .kv b{color:var(--green);text-align:right;font-variant-numeric:tabular-nums}
  .qc{font-size:11px;font-weight:800;letter-spacing:.05em;padding:3px 8px;border-radius:999px;background:rgba(111,184,255,.15);color:var(--blue);white-space:nowrap}
  .flow{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 12px}
  .flow span{font-size:12px;font-weight:700;padding:6px 10px;border-radius:999px;background:var(--card);border:1px solid var(--line);color:var(--ink2)}
  .flow span b{color:var(--green)}
  .flow span.later{color:var(--ink3);border-style:dashed}
  .pts{list-style:none;counter-reset:p;margin:0;padding:0}
  .pts>li{counter-increment:p;position:relative;padding:11px 0 11px 36px;border-bottom:1px solid var(--line)}
  .pts>li:last-child{border-bottom:0}
  .pts>li::before{content:counter(p);position:absolute;left:0;top:12px;width:25px;height:25px;border-radius:50%;
    background:var(--green);color:var(--onacc);font-weight:800;font-size:13px;text-align:center;line-height:25px}
  .bars{margin:9px 0 2px}
  .bar{display:grid;grid-template-columns:minmax(80px,112px) 1fr auto;gap:9px;align-items:center;padding:3px 0;font-size:13px}
  .bar .lb{color:var(--ink2);line-height:1.2}
  .track{position:relative;height:16px;background:var(--card2);border-radius:4px;overflow:hidden}
  .fill{position:absolute;left:0;top:0;bottom:0;border-radius:4px}
  .fill.was{background:var(--line)}
  .fill.now{background:var(--green);opacity:.85}
  .fill.now.bad{background:var(--red)}
  .fill.now.warn{background:var(--amber)}
  .vv{font-variant-numeric:tabular-nums;color:var(--ink);font-weight:700;font-size:12.5px;text-align:right;max-width:150px}
  .vv s{color:var(--ink3);font-weight:400;text-decoration:line-through;opacity:.85}
  .note{font-size:12.5px;color:var(--ink3);margin:6px 0 0}
  details{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:0 14px;margin:10px 0 0}
  details[open]{padding-bottom:12px}
  summary{cursor:pointer;list-style:none;padding:11px 0;font-size:13px;font-weight:700;color:var(--ink2);display:flex;align-items:center;gap:7px}
  summary::-webkit-details-marker{display:none}
  summary::before{content:"▸";transition:transform .15s;display:inline-block;color:var(--ink3);flex:0 0 auto}
  details[open]>summary::before{transform:rotate(90deg)}
  details p{margin:0 0 9px;color:var(--ink2);font-size:14px}
  details ul,details ol{margin:0 0 9px;padding-left:20px;color:var(--ink2);font-size:14px}
  details li{margin-bottom:6px}
  details .tw{margin:8px 0}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.85em;background:var(--card2);border:1px solid var(--line);border-radius:4px;padding:1px 5px;color:var(--ink);word-break:break-word}
  .pill{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;vertical-align:1px}
  .p-red{background:rgba(255,107,107,.15);color:var(--red)}
  .p-amb{background:rgba(245,185,66,.15);color:var(--amber)}
  .p-grn{background:rgba(61,220,132,.15);color:var(--green)}
  .p-blu{background:rgba(111,184,255,.15);color:var(--blue)}
  figure{margin:12px 0 2px}
  figure img{width:100%;max-width:100%;height:auto;display:block;border-radius:var(--r);border:1px solid var(--line);background:var(--card2)}
  figure figcaption{font-size:12px;color:var(--ink3);margin-top:7px;line-height:1.4}
  .fig{max-width:420px}
  .tw{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--card);max-width:100%;-webkit-overflow-scrolling:touch}
  table{border-collapse:collapse;width:100%;font-size:13px}
  th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line);overflow-wrap:anywhere}
  th{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);white-space:nowrap}
  tr:last-child td{border-bottom:0}
  table.nw td:first-child{white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--ink);font-weight:700}
  td{color:var(--ink2)} td b{color:var(--ink)}
  pre{margin:0;padding:12px;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ink2);min-width:max-content}
  svg text{font-family:-apple-system,Segoe UI,Roboto,sans-serif}
  .diag{padding:12px;margin:12px 0 4px}
  .mock{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px;margin:12px 0 4px;max-width:420px}
  .mock .who{font-weight:800;font-size:12px;letter-spacing:.08em;color:var(--green);display:flex;justify-content:space-between}
  .mock .who span{color:var(--ink3);font-weight:600;letter-spacing:0}
  .mock .wait{font-size:12.5px;color:var(--ink2);margin-top:6px}
  .alert{border:1px solid var(--line);border-left:3px solid var(--amber);background:var(--card);border-radius:var(--r);padding:12px 14px;margin:12px 0}
  .alert .t{font-weight:800;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--amber);margin-bottom:4px}
  .alert p{margin:0;font-size:14px;color:var(--ink2)}
  /* ---- YOUR CALLS ---- */
  #calls{scroll-margin-top:0}
  .cbar{position:sticky;top:env(safe-area-inset-top,0px);z-index:30;background:var(--bg);border-bottom:1px solid var(--line);
    padding:8px 0;margin:0 0 10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .cbar .cnt{font-weight:800;font-size:15px;margin-right:auto;font-variant-numeric:tabular-nums}
  .cbar .cnt small{display:block;font-weight:600;font-size:11.5px;color:var(--ink3)}
  .btn{font:inherit;font-size:13px;font-weight:700;border:1px solid var(--line);background:var(--card);color:var(--ink);
    padding:0 12px;min-height:38px;border-radius:10px;cursor:pointer}
  .btn.pri{background:var(--green);color:var(--onacc);border-color:var(--green)}
  .seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}
  .seg button{font:inherit;font-size:12.5px;font-weight:700;border:0;background:var(--card);color:var(--ink2);padding:0 12px;min-height:36px;cursor:pointer}
  .seg button[aria-pressed="true"]{background:var(--card2);color:var(--green)}
  .frow{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--ink3);margin:0 0 6px}
  #cmsg{font-size:12.5px;color:var(--green);flex-basis:100%}
  #cmsg:empty{display:none}
  #cpy{width:100%;min-height:90px;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px}
  .plan{margin:20px 0 0}
  .plan>.ph{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px}
  .plan>.ph b{font-size:15px;margin-right:auto}
  .plan>.ph .pc{font-size:12px;color:var(--ink3);font-variant-numeric:tabular-nums}
  details.grp{padding:0 12px}
  details.grp>summary{color:var(--ink);font-size:13.5px}
  details.grp>summary .gc{margin-left:auto;font-size:11.5px;color:var(--ink3);font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
  details.grp.empty{display:none}
  ul.ql{list-style:none;margin:0;padding:0}
  .qi{padding:12px 0 12px 10px;border-top:1px solid var(--line);border-left:3px solid transparent;margin-left:-3px}
  .qi.y{border-left-color:var(--green)} .qi.n{border-left-color:var(--red)}
  .qi.done.note-only{border-left-color:var(--amber)}
  #calls.f-un .qi.done{display:none}
  .qt{font-size:14px;color:var(--ink);line-height:1.4}
  .qid{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.04em;color:var(--blue);background:rgba(111,184,255,.12);border-radius:5px;padding:1px 6px;margin-right:6px;vertical-align:1px;white-space:nowrap}
  .qr,.qe{font-size:12.5px;line-height:1.4;margin-top:4px;color:var(--ink2)}
  .qr b{color:var(--green)} .qe b{color:var(--ink3)}
  .qb{display:flex;gap:6px;margin-top:8px}
  .qb button{flex:1 1 0;font:inherit;font-size:12.5px;font-weight:700;border:1px solid var(--line);background:var(--card2);color:var(--ink2);
    min-height:38px;border-radius:9px;cursor:pointer;padding:0 6px}
  .qb button[aria-pressed="true"][data-a="y"]{background:var(--green);color:var(--onacc);border-color:var(--green)}
  .qb button[aria-pressed="true"][data-a="n"]{background:var(--red);color:#fff;border-color:var(--red)}
  .qb button[aria-pressed="true"][data-a="note"]{background:var(--amber);color:#1a1200;border-color:var(--amber)}
  input.qn{width:100%;margin-top:6px;font:inherit;font-size:14px;padding:8px 10px;border-radius:9px;border:1px solid var(--line);background:var(--card2);color:var(--ink)}
  footer{margin-top:48px;padding-top:18px;border-top:1px solid var(--line);color:var(--ink3);font-size:12.5px}
</style>
'''
