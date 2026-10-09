// Real local HTTP requests. Sandbox only. No authentication bypass.
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
const mongoose=require('mongoose');
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {League}=require('../dist/models/League');
const {Reservation}=require('../dist/models/Reservation');
const {WorldpayPayment}=require('../dist/payment/worldpayPayment');
const {WorldpayProvider}=require('../dist/payment/worldpayProvider');
const {cancelReservation}=require('../dist/lib/reservationService');
const output={utc:new Date().toISOString(),environment:'sandbox',transport:'authenticated local HTTP',calls:8};
(async()=>{
 try {
  if(process.env.PAYMENT_PROVIDER!=='worldpay'||process.env.WORLDPAY_ENVIRONMENT!=='sandbox')throw Error('Sandbox required');
  process.env.CLIENT_URL='http://localhost:5173';process.env.WORLDPAY_RETURN_ORIGIN=process.env.CLIENT_URL;
  const uri=new URL(process.env.MONGODB_URI);uri.pathname='/worldpay_evidence_20261008';
  await mongoose.connect(uri.toString());
  const seed=await League.findOne({slug:'evidence-double'}).lean();
  if(!seed)throw Error('Disposable evidence database required');
  delete seed._id;delete seed.__v;
  const slug='evidence-http-concurrent';
  if(await League.exists({slug}))throw Error('This evidence run already exists');
  await League.create({...seed,slug,name:'Sandbox HTTP concurrency evidence',spotsRemaining:10,playerLimit:10});
  output.capacityBefore=10;
  const email='worldpay.concurrent.20261009@example.test';
  const base='http://127.0.0.1:3001';
  const headers={Origin:process.env.CLIENT_URL,'Content-Type':'application/json'};
  const signup=await fetch(base+'/api/auth/signup',{method:'POST',headers,body:JSON.stringify({email,password:randomBytes(24).toString('hex'),firstName:'HTTP',lastName:'Witness',ntrp:'3.5',city:'Atlanta',zipCode:'30309'})});
  if(signup.status!==201)throw Error('Normal signup failed: '+signup.status);
  const cookie=signup.headers.getSetCookie().find(x=>x.includes('Max-Age'))?.split(';')[0];
  if(!cookie)throw Error('Normal signup did not establish a session');
  output.testUser={email,method:'Normal API signup',passwordSaved:false};
  const replies=await Promise.all(Array.from({length:8},async()=>{
   const res=await fetch(base+'/api/registrations',{method:'POST',headers:{...headers,Cookie:cookie},body:JSON.stringify({leagueId:slug,playerEmail:email})});
   const json=await res.json();
   return {httpStatus:res.status,ok:json.ok,reservationId:json.data?.reservation?.id,status:json.data?.reservation?.status,error:json.error};
  }));
  output.responses=replies;
  output.uniqueReservationResponses=new Set(replies.map(x=>x.reservationId).filter(Boolean)).size;
  const rows=await Reservation.find({leagueSlug:slug});
  output.reservationCount=rows.length;
  output.setupCount=await WorldpayPayment.countDocuments({reservationId:{$in:rows.map(x=>x.id)}});
  output.capacityAfterCreate=(await League.findOne({slug})).spotsRemaining;
  output.confirmedCount=await Reservation.countDocuments({leagueSlug:slug,status:'registered'});
  const provider=new WorldpayProvider();
  output.providerStates=await Promise.all(rows.map(async r=>({orderReference:r.id,state:await provider.retrievePayment(r.paymentIntentId)})));
  output.note='Unpaid hosted setup has no Reporting transaction. Zero charge records is expected before card submission. Portal counts are not verified.';
  for(const r of rows)await cancelReservation(r.id,'cancelled');
  output.capacityAfterVerifiedCancellation=(await League.findOne({slug})).spotsRemaining;
 }catch(e){output.error=e.message;process.exitCode=1;}
 finally{
  await mongoose.disconnect();output.finishedUtc=new Date().toISOString();
  const file=path.join(__dirname,'../../docs/evidence',output.utc.replace(/[:.]/g,'')+'-http-concurrent.json');
  fs.writeFileSync(file,JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
 }
})();
