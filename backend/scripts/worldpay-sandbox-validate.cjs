// Explicit sandbox-only validation. Never prints credentials or card fields.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const { WorldpayProvider } = require('../dist/payment/worldpayProvider');
const { WorldpayPayment, WorldpayObservation, WorldpayOperation } = require('../dist/payment/worldpayPayment');
const { Reservation } = require('../dist/models/Reservation');
const { League } = require('../dist/models/League');
const { reconcileReservation } = require('../dist/lib/reservationService');
const [operation, reference, amount] = process.argv.slice(2);
(async () => {
  try {
    if (process.env.PAYMENT_PROVIDER !== 'worldpay' || (process.env.WORLDPAY_ENVIRONMENT ?? 'sandbox') !== 'sandbox') throw Error('Only the Worldpay sandbox is allowed');
    if (!['inspect', 'reconcile', 'refund'].includes(operation) || !/^worldpay_[a-f0-9]{24}$/.test(reference ?? '')) throw Error('Usage: node scripts/worldpay-sandbox-validate.cjs inspect|reconcile|refund worldpay_RESERVATION_ID [refundCents]');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    const r = await Reservation.findOne({ paymentIntentId: reference, paymentProvider: 'worldpay' });
    if (!r) throw Error('Reservation not found');
    const provider = new WorldpayProvider();
    async function snapshot() {
      const state = await provider.retrievePayment(reference);
      const reservation = await Reservation.findById(r.id);
      const league = await League.findOne({ slug: r.leagueSlug });
      const ledger = await WorldpayObservation.find({ paymentId: reference }).lean();
      return { providerStatus: state.status, amountCents: state.amountCents, currency: state.currency, reservationStatus: reservation.status, spotsRemaining: league.spotsRemaining, confirmedRegistrations: await Reservation.countDocuments({ leagueSlug: r.leagueSlug, status: { $in: ['registered','paid'] } }), transactions: ledger.map(t => ({ id: t.transactionId, orderReference: t.orderReference, amountCents: t.amountCents, status: t.providerStatus, type: t.transactionType, eventTime: t.providerEventTime, verifiedAt: t.verifiedAt, currency: t.currency, currencySource: t.currencySource })) };
    }
    const before = await snapshot();
    let result;
    if (operation === 'reconcile') {
      result = { first: (await reconcileReservation(r.id)).status, replay: (await reconcileReservation(r.id)).status };
    }
    if (operation === 'refund') {
      const cents = Number(amount);
      if (!Number.isSafeInteger(cents) || cents <= 0) throw Error('Supply a positive integer refund amount in cents');
      result = { first: await provider.refundPayment({ paymentIntentId: reference, amountCents: cents }), replay: await provider.refundPayment({ paymentIntentId: reference, amountCents: cents }) };
      const refundId = result.first.refundId;
      const report = await provider.request('TransactionQuery', { Parameters: { TransactionID: refundId } }, true);
      // Provider independently acknowledges the refund query. Raw ReportingData is excluded.
      result.refundQueryCode = report.ExpressResponseCode;
      result.savedOperation = await WorldpayOperation.findOne({ paymentId: reference, transactionId: refundId }).select('type amountCents status completedAt').lean();
    }
    console.log(JSON.stringify({ at: new Date().toISOString(), environment: 'sandbox', operation, reference, before, result, after: await snapshot() }, null, 2));
  } catch (e) { console.error(JSON.stringify({ error: e.message, providerCode: e.code, providerMessage: e.providerMessage })); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
})();
