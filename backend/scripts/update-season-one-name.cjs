const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Season = mongoose.model('Season', new mongoose.Schema({}, { strict: false }));
  const res = await Season.updateOne(
    { slug: 's-fall-26' },
    { $set: { name: 'Season One', operatingState: 'active-season' } }
  );
  console.log('Update result:', res);
  const seasons = await Season.find({}).lean();
  console.log('Seasons now:', seasons.map(s => ({ slug: s.slug, name: s.name, status: s.status, operatingState: s.operatingState })));
  await mongoose.disconnect();
}

run().catch(console.error);
