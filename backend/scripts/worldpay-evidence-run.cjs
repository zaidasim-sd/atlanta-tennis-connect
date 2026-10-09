// Sandbox evidence only. No authentication bypass or shared interface changes.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');
const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser({ parseTagValue: false, removeNSPrefix: true });
const { WorldpayProvider } = require('../dist/payment/worldpayProvider');
const { WorldpayPayment, WorldpayObservation } = require('../dist/payment/worldpayPayment');
const { Reservation } = require('../dist/models/Reservation');
const { League } = require('../dist/models/League');
const { reconcilePayments } = require('../dist/jobs/reconcilePayments');
const [mode, id] = process.argv.slice(2);
const root = path.resolve(__dirname, '../../docs/evidence');
const output = { utc: new Date().toISOString(), mode, environment: 'sandbox', apiRecords: [] };
const allowed = new Set(['Response','TransactionQueryResponse','CreditCardReversalResponse','TransactionSetupExpireResponse','ExpressResponseCode','ExpressResponseMessage','ReportingData','Items','Item','Transaction','TransactionID','OriginalTransactionID','ReferenceNumber','TransactionSetupID','TransactionType','TransactionStatus','TransactionStatusCode','ApprovedAmount','TransactionAmount','TimeStamp','ExpressTransactionDate','ExpressTransactionTime','ExpressTransactionTimezone','Currency','CurrencyCode']);
function safe(value) {
  if (Array.isArray(value)) return value.map(safe);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, allowed.has(k) ? safe(v) : '[REDACTED]']));
  if (typeof value === 'string' && value.trim().startsWith('<')) return safe(parser.parse(value));
  return value;
}
const nativeFetch = global.fetch;
global.fetch = async (url, options) => {
  if (!/^https:\/\/cert(transaction|reporting)\.elementexpress\.com\/$/.test(String(url))) throw Error('Non certification request blocked');
  const response = await nativeFetch(url, options);
  output.apiRecords.push({ utc: new Date().toISOString(), response: safe(parser.parse(await response.clone().text())) });
  return response;
};
async function snapshot() {
  const provider = new WorldpayProvider();
  const reservations = await Reservation.find(mode === 'reverse' ? { paymentIntentId: id } : { leagueSlug: /^evidence-/ });
  const rows = [];
  for (const r of reservations) {
    let state;
    try { state = await provider.retrievePayment(r.paymentIntentId); } catch(e) { state = { error: e.message }; }
    const p = await WorldpayPayment.findById(r.paymentIntentId);
    const league = await League.findOne({ slug: r.leagueSlug });
    rows.push({ reservationId: r.id, orderReference: r.id, league: r.leagueSlug, reservationStatus: r.status, amountCents: r.amountCents, heldAt: r.heldAt, expiresAt: r.expiresAt, provider: state, setupId: p?.setupId, captureTransactionId: p?.captureTransactionId, capacity: league?.spotsRemaining, reservationCount: await Reservation.countDocuments({ leagueSlug: r.leagueSlug }), confirmedCount: await Reservation.countDocuments({ leagueSlug: r.leagueSlug, status: { $in: ['registered','paid'] } }), setupCount: await WorldpayPayment.countDocuments({ reservationId: r.id }), observations: await WorldpayObservation.find({ paymentId: r.paymentIntentId }).select('transactionId transactionType providerStatus providerStatusCode amountCents providerEventTime verifiedAt currency currencySource -_id').lean() });
  }
  return rows;
}
(async () => {
  try {
    if (process.env.PAYMENT_PROVIDER !== 'worldpay' || (process.env.WORLDPAY_ENVIRONMENT || 'sandbox') !== 'sandbox') throw Error('Sandbox required');
    process.env.CLIENT_URL = 'http://localhost:5173';
    process.env.WORLDPAY_RETURN_ORIGIN = process.env.CLIENT_URL;
    if (mode !== 'reverse') {
      const uri = new URL(process.env.MONGODB_URI);
      uri.pathname = '/worldpay_evidence_20261008';
      process.env.MONGODB_URI = uri.toString();
    }
        if (mode === 'reverse' && fs.existsSync(path.join(root, '2026-10-08T124109681Z-reverse.json'))) throw Error('The permitted reversal retry is already recorded. Further reversal attempts are disabled.');
    await mongoose.connect(process.env.MONGODB_URI);
    const provider = new WorldpayProvider();
    output.before = await snapshot();
    if (mode === 'concurrent') {
      const r = await Reservation.findOne({ leagueSlug: 'evidence-double' });
      if (!r) throw Error('Browser reservation required');
      const input = { reservationId: r.id, amountCents: r.amountCents, currency: 'usd', description: 'Sandbox concurrency evidence', playerEmail: r.playerEmail, metadata: {} };
      const results = await Promise.allSettled(Array.from({ length: 8 }, () => provider.createPayment(input)));
      output.concurrent = { calls: 8, succeeded: results.filter(r => r.status === 'fulfilled').length, uniqueSetupURLs: new Set(results.filter(r => r.status === 'fulfilled').map(r => r.value.checkoutUrl)).size, failures: results.filter(r => r.status === 'rejected').map(r => r.reason.message), note: 'Adapter create calls reuse the real sandbox session. These are not HTTP registration requests.' };
    }
    if (mode === 'replay') {
      const r = await Reservation.findOne({ leagueSlug: 'evidence-success' });
      const payment = await WorldpayPayment.findById(r?.paymentIntentId).select('+validationCode');
      if (!r || !payment?.validationCode) throw Error('Paid browser order with saved validation required');
      if ((await provider.retrievePayment(r.paymentIntentId)).status !== 'paid') throw Error('Paid order required');
      for (let i=0; i<2; i++) await provider.verifyCheckoutReturn(r.paymentIntentId, { TransactionSetupID: payment.setupId, ValidationCode: payment.validationCode });
      output.returnReplays = 2;
      output.jobReplays = [await reconcilePayments(), await reconcilePayments()];
    }
        if (mode === 'reports') {
      output.reports = [];
      for (const r of await Reservation.find({ leagueSlug: /^evidence-/ })) {
        const report = await provider.request('TransactionQuery', { Parameters: { ReferenceNumber: r.id, TransactionDateTimeBegin: '2026-10-07 00:00:00', TransactionDateTimeEnd: '2026-10-10 23:59:59' } }, true);
        const data = typeof report.ReportingData === 'string' ? parser.parse(report.ReportingData) : report.ReportingData;
        const items = [];
        const walk = v => { if (!v || typeof v !== 'object') return; for (const [key,value] of Object.entries(v)) { if (key === 'Item') items.push(...(Array.isArray(value) ? value : [value])); else walk(value); } };
        walk(data);
        const approvedCaptures = items.filter(x => x.TransactionType === 'CreditCardAuthorizationCompletion' && x.TransactionStatus === 'Approved');
        output.reports.push({ orderReference: r.id, source: 'Authenticated Reporting API, not portal', responseCode: report.ExpressResponseCode, rows: items.map(safe), transactionRecordCount: items.length, approvedCaptureCount: new Set(approvedCaptures.map(x => x.TransactionID)).size });
      }
    }
    if (mode === 'job') output.jobs = [await reconcilePayments(), await reconcilePayments()];
    if (mode === 'reverse') {
      if (id !== 'worldpay_6ac73581002db8be709a38e3') throw Error('Only the specified existing order is allowed');
      if ((await provider.retrievePayment(id)).status !== 'authorized') output.reversal = 'Not run because current state is not Authorized';
      else {
        // Existing action derives the existing deterministic key. One request only.
        try { await provider.action(id, 'CreditCardReversal'); output.reversal = 'Accepted'; }
        catch(e) { output.reversal = { error: e.message, code: e.code, providerMessage: e.providerMessage }; }
      }
    }
    output.after = await snapshot();
  } catch(e) { output.error = e.message; process.exitCode = 1; }
  finally {
    await mongoose.disconnect();
    output.finishedUtc = new Date().toISOString();
    const filename = `${output.utc.replace(/[:.]/g,'')}-${mode}.json`;
    fs.writeFileSync(path.join(root, filename), JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
  }
})();
