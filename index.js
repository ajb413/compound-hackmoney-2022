const express = require('express');
const app = express();
const port = 8080;
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite3');
const ethers = require('ethers');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const jsonRpcUrl = process.env.MAINNET_PROVIDER_URL;

// Serve all front end files from the public folder
app.use(express.static('public'));

// Get all interest rates from the past 30 days
app.get('/rates/thirty/:ctoken', async (req, res) => {
  const cTokenAddress = req.params.ctoken;
  const result = await getRatesThirtyDays(cTokenAddress);

  res.send(result);
});

async function getRatesThirtyDays(cTokenAddress) {
  // 30 days ago
  const oldest = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().substring(0, 10) + 'T00:00:00.000Z';
  // today
  const newest = new Date().toISOString().substring(0, 10) + 'T00:00:00.000Z';

  // First try to get cached rates from the sqlite DB
  let result = await sqliteAll(`
      SELECT * FROM interest_rates
        WHERE ctoken_address = $1
        AND ( timestamp BETWEEN $2 AND $3 )
        ORDER BY timestamp ASC;
        LIMIT 30;
    `,
    [cTokenAddress, oldest, newest]
  );

  if (!result || result.length !== 30) {
    const timestamps = getDayTimestamps(-30, 0);
    result = await fillInMissingRates(cTokenAddress, timestamps, result);
  }

  return result;
}

function getDayTimestamps(from, to) {
  const result = [];

  from++;
  to++;
  while (from < to) {
    result.push(new Date(new Date().setDate(new Date().getDate() + from)).toISOString().substring(0, 10) + 'T00:00:00.000Z');
    from++;
  }

  return result;
}

async function fillInMissingRates(cTokenAddress, timestamps, dbRows) {
  dbRows = dbRows || [];
  const promises = [];

  const abi = [ 'function supplyRatePerBlock() returns (uint)' ];
  const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
  const cToken = new ethers.Contract(cTokenAddress, abi, provider);

  // Fib using eth_getBlockByNumber because you can't eth_getBlockByTimestamp
  const oldestTs = new Date(timestamps[0]).getTime() / 1000;
  const res = await fetch(`https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp=${oldestTs}&closest=before`);
  const oldestBlockByTimestamp = +(await res.json()).result;

  const indexes = [];
  timestamps.forEach((ts, i) => {
    const found = dbRows.find(_ => _.timestamp === ts);
    const delta = (new Date(ts).getTime() / 1000) - oldestTs;
    const blockTag = parseInt(oldestBlockByTimestamp + (delta / 13.5));
    if (!found) {
      promises.push(cToken.callStatic.supplyRatePerBlock({ blockTag }));
      indexes.push(i);
    }
  });

  try {
    const missingRates = [];
    const rates = await Promise.all(promises);

    let insertVals = '';
    rates.forEach((rate, i) => {
      missingRates.push({
        timestamp: timestamps[indexes[i]],
        ctoken_address: cTokenAddress,
        rate: (+rate.toString()).toString(),
      });
      insertVals += `('${timestamps[indexes[i]]}', '${cTokenAddress}', '${(+rate.toString()).toString()}'),`;
    });
    insertVals = insertVals.slice(0, -1);

    // Insert all of the missing rates into the DB
    await sqliteRun(`
      INSERT INTO interest_rates (timestamp, ctoken_address, rate)
        VALUES ${insertVals};`
    );

    // Merged the newly fetched rates with any rates the DB already had
    const merged = missingRates.concat(dbRows);

    return merged;
  } catch(e) {
    console.error(e);
    return [];
  }
}

function sqliteRun(query, params) {
  return new Promise((resolve, reject) => {
    db.run(query, params, (err) => { err ? reject(err) : resolve(); });
  });
}

function sqliteAll(query, params) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => { err ? reject(err) : resolve(rows); });
  });
}

// Main setup function
(async () => {
  // Set up sqlite database if it is not already initialized
  await sqliteRun(`
    CREATE TABLE IF NOT EXISTS interest_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      ctoken_address TEXT,
      rate TEXT
    );`
  );

  // Run the web server on port 8080
  app.listen(port, () => {
    console.log(`\nWeb3 app running at http://localhost:${port}\n`);
  });
})().catch(console.error);
