// Real Stripe test-mode declines on staging. No raw credentials enter evidence.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const Stripe = require('stripe');
const env = dotenv.parse(fs.readFileSync(process.env.VALIDATION_ENV_FILE || path.join(__dirname, '../.env')));
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Test key required');
const stripe = new Stripe(env.STRIPE_SECRET_KEY,{timeout:15000,maxNetworkRetries:0});
const base=process.env.TEST_BASE_URL || 'https://atlanta-tennis-staging.vercel.app';
const leagueId=process.env.TEST_LEAGUE_ID;
if (!leagueId) throw new Error('Set TEST_LEAGUE_ID to an isolated QA league');
const output=path.resolve(process.env.VALIDATION_OUTPUT || 'docs/evidence/2026-10-12/stripe-declines.json');
const evidence={startedAt:new Date().toISOString(),environment:base,provider:'stripe',livemode:false,leagueId,cases:[]};
async function request(route,{method='GET',cookie,body}={}) {
  const r=await fetch(base+route,{method,signal:AbortSignal.timeout(30000),headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:r.status,headers:r.headers,body:await r.json()};
}
async function spots(){const r=await request('/api/leagues');return r.body.data.find(l=>l.id===leagueId).spotsRemaining;}
async function main(){
  fs.mkdirSync(path.dirname(output),{recursive:true});
  evidence.spotsBefore=await spots();
  for(const [name,method,expected] of [['insufficient-funds','pm_card_chargeDeclinedInsufficientFunds','insufficient_funds'],['fraudulent','pm_card_chargeDeclinedFraudulent','fraudulent']]){
    const result={name,startedAt:new Date().toISOString()}; evidence.cases.push(result);
    const email=`qa-gap-${Date.now()}-${name}@example.test`;
    const password=crypto.randomBytes(24).toString('hex');
    const signup=await request('/api/auth/signup',{method:'POST',body:{email,password,firstName:'Validation',lastName:'QA',ntrp:'4.0',gender:'male',zipCode:'30309'}});
    result.signupStatus=signup.status;
    if(signup.status!==201) throw new Error(`Signup HTTP ${signup.status}`);
    const cookie=signup.headers.getSetCookie().find(v=>/Max-Age=[1-9]/.test(v))?.split(';')[0];
    if(!cookie) throw new Error('No session');
    let id;
    try{
      const r=await request('/api/registrations',{method:'POST',cookie,body:{leagueId,playerEmail:email,homeCourtId:'mcclatchey'}});
      result.reservationHttpStatus=r.status;
      if(r.status!==201) {result.reservationError=r.body.error; throw new Error(`Reservation HTTP ${r.status}: ${r.body.error}`);}
      id=r.body.data.reservation.id; result.reservationId=id;
      const pi=r.body.data.reservation.paymentIntentId; result.paymentIntentId=pi;
      if(!pi?.startsWith('pi_')) throw new Error('Staging is not using Stripe');
      const retryBody={leagueId,playerEmail:email,homeCourtId:'mcclatchey'};
      const retries=await Promise.all([request('/api/registrations',{method:'POST',cookie,body:retryBody}),request('/api/registrations',{method:'POST',cookie,body:retryBody})]);
      result.retries=retries.map(x=>({httpStatus:x.status,reservationId:x.body.data?.reservation?.id,paymentIntentId:x.body.data?.reservation?.paymentIntentId,expiresAt:x.body.data?.reservation?.expiresAt}));
      result.retryAssertions={sameReservation:result.retries.every(x=>x.reservationId===id),sameIntent:result.retries.every(x=>x.paymentIntentId===pi),holdNotExtended:result.retries.every(x=>x.expiresAt===r.body.data.reservation.expiresAt)};
      const refresh=await request('/api/registrations?email='+encodeURIComponent(email),{cookie});
      result.refreshFoundOriginal=refresh.body.data?.some(x=>x.id===id&&x.paymentIntentId===pi);
      result.spotsHeld=await spots();
      try{await stripe.paymentIntents.confirm(pi,{payment_method:method});result.unexpectedConfirmation=true;}
      catch(e){result.errorCode=e.code;result.declineCode=e.decline_code;}
      const intent=await stripe.paymentIntents.retrieve(pi);
      result.stripeStatus=intent.status; result.livemode=intent.livemode;
      const events=await stripe.events.list({type:'payment_intent.payment_failed',limit:30});
      result.events=events.data.filter(e=>e.data.object.id===pi).map(e=>({id:e.id,type:e.type,created:e.created,pending_webhooks:e.pending_webhooks,livemode:e.livemode}));
      const state=await request('/api/payments/status/'+id,{cookie});
      result.applicationStatus=state.body.data?.status;result.paymentStatus=state.body.data?.paymentStatus;
      result.spotsAfterDecline=await spots();
      result.assertions={declineMatches:result.declineCode===expected,testMode:intent.livemode===false,notRegistered:state.body.data?.status==='payment_pending',paymentNotPaid:state.body.data?.paymentStatus==='pending',slotRetained:result.spotsAfterDecline===result.spotsHeld,providerEventExists:result.events.length>0};
    }finally{
      if(id){const clean=await request('/api/payments/'+id+'/cancel',{method:'POST',cookie});result.cleanupHttpStatus=clean.status;result.cleanupReleased=clean.body.data?.released; result.spotsAfterCleanup=await spots();}
      await request('/api/auth/logout',{method:'POST',cookie});
      fs.writeFileSync(output,JSON.stringify(evidence,null,2));
    }
  }
  evidence.spotsAfter=await spots(); evidence.capacityRestored=evidence.spotsAfter===evidence.spotsBefore;
  evidence.completedAt=new Date().toISOString();
  evidence.passed=evidence.capacityRestored&&evidence.cases.every(c=>c.assertions&&Object.values(c.assertions).every(Boolean)&&Object.values(c.retryAssertions||{}).every(Boolean)&&c.refreshFoundOriginal&&c.cleanupReleased);
  fs.writeFileSync(output,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
  if(!evidence.passed)process.exitCode=1;
}
main().catch(e=>{evidence.error=e.message;fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(evidence,null,2));console.error(e.message);process.exitCode=1;});
