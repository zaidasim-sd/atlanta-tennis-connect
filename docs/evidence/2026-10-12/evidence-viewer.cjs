// Read-only local display of saved evidence, used to capture report screenshots.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const dir=__dirname;
const pages={declines:{title:'Real Stripe decline validation',file:'stripe-declines.json',note:'Actual staging requests and Stripe test API results. No real-money transaction. Saved 12 October 2026.'},webhooks:{title:'Stripe events and staging delivery logs',files:['webhook-event-followup.json','webhook-delivery-logs.json'],note:'Raw saved provider event status and Vercel request logs. Logs show HTTP 200; event IDs are not included in runtime log lines. Correlation uses event/request time.'},tests:{title:'Confirmation security regression and backend suite',file:'backend-tests.txt',note:'Actual local Node test output against an in-memory MongoDB replica set. This is not a deployed security check.'}};
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');const key=url.pathname.slice(1);const p=pages[key];
 if(!p){res.writeHead(404);return res.end('Unknown evidence');}
 let texts='';
 if(key==='declines'){
  const b=JSON.parse(fs.readFileSync(path.join(dir,p.file),'utf8'));
  texts='<p><b>Environment:</b> '+escape(b.environment)+'<br><b>Run:</b> '+escape(b.startedAt)+' to '+escape(b.completedAt)+'<br><b>League:</b> '+escape(b.leagueId)+'<br><b>Capacity:</b> '+b.spotsBefore+' before / '+b.spotsAfter+' after cleanup<br><b>Overall pass:</b> '+b.passed+'</p>';
  for(const c of b.cases.filter(c=>!url.searchParams.get('case')||c.name===url.searchParams.get('case')))texts+='<h2>'+escape(c.name)+'</h2><pre>'+escape(JSON.stringify({reservationId:c.reservationId,paymentIntentId:c.paymentIntentId,declineCode:c.declineCode,stripeStatus:c.stripeStatus,livemode:c.livemode,applicationStatus:c.applicationStatus,paymentStatus:c.paymentStatus,spotsHeld:c.spotsHeld,spotsAfterDecline:c.spotsAfterDecline,spotsAfterCleanup:c.spotsAfterCleanup,retryAssertions:c.retryAssertions,refreshFoundOriginal:c.refreshFoundOriginal,assertions:c.assertions},null,2))+'</pre>';
 }else if(key==='webhooks'){
  const events=JSON.parse(fs.readFileSync(path.join(dir,'webhook-event-followup.json'),'utf8'));
  const logs=JSON.parse(fs.readFileSync(path.join(dir,'webhook-delivery-logs.json'),'utf8'));
  texts='<h2>Saved Stripe event follow-up</h2><p>Checked '+escape(events.checkedAt)+'</p>';
  for(const e of events.events)texts+='<pre>'+escape(e.id)+'\n'+escape(e.type)+' | pending_webhooks='+e.pending_webhooks+' | livemode='+e.livemode+'</pre>';
  texts+='<h2>Saved Vercel webhook request acknowledgements</h2><p>Deployment dpl_jqV5yDjnLt4BR2AuPc8WejUU5RWi<br>Path /api/payments/webhook</p>';
  for(const l of logs)texts+='<pre>'+escape(l.id)+'\n'+new Date(l.timestamp).toISOString()+' | HTTP '+l.responseStatusCode+'</pre>';
 }else{
  const t=fs.readFileSync(path.join(dir,p.file),'utf8');
  texts='<h2>Saved test output excerpts</h2><pre>'+escape(t.split('\n').filter(l=>/client confirmation|league creation requires|CORS|tests 33|pass 33|fail 0|duration_ms/.test(l)).join('\n'))+'</pre><h2>Test scope</h2><p>The backend regression verifies anonymous, cross-account, missing reservation and unpaid confirmation rejection; provider-verified payment confirms once. Other tests cover reservation races, retry, cancellation, expiry and webhook validation.</p>';
 }
 const html='<!doctype html><html><head><meta charset="utf-8"><title>'+p.title+'</title><style>body{font:16px Arial;margin:32px;color:#172b40}h1{font-size:27px}h2{font-size:17px;color:#44617d}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.55 Consolas,monospace;background:#f3f6f8;padding:20px;border-radius:7px}p{max-width:850px;line-height:1.5}</style></head><body><h1>'+p.title+'</h1><p>'+p.note+'</p>'+texts+'</body></html>';
 res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(html);
}).listen(8799,'127.0.0.1',()=>console.log('Evidence viewer http://127.0.0.1:8799'));
