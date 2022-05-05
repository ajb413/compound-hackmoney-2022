const compound = new Compound(window.ethereum);

const ethApyElement = document.getElementById('eth-apy');
const ethSupplyInput = document.getElementById('eth-supply');
const ethSupplyButton = document.getElementById('eth-supply-button');
const ethRedeemInput = document.getElementById('eth-redeem');
const ethRedeemButton = document.getElementById('eth-redeem-button');
const enableEthereumButton = document.getElementById('enable-button');

enableEthereumButton.onclick = async () => {
  await ethereum.request({ method: 'eth_requestAccounts' });
};

ethSupplyButton.onclick = async () => {
  const amount = +ethSupplyInput.value;
  await supply(Compound.ETH, amount);
};

ethRedeemButton.onclick = async () => {
  const amount = +ethRedeemInput.value;
  await redeem(Compound.cETH, amount);
};

async function supply(asset, amount) {
  if (!isNaN(amount) && amount !== 0) {
    try {
      const trx = await compound.supply(asset, amount);
      console.log(asset, 'Supply', amount, trx);
      console.log('Transaction Hash', trx.hash);
    } catch (err) {
      alert(JSON.stringify(err));
    }
  }
}

async function redeem(asset, amount) {
  if (!isNaN(amount) && amount !== 0) {
    try {
      const trx = await compound.redeem(asset, amount);
      console.log(asset, 'Redeem', amount, trx);
      console.log('Transaction Hash', trx.hash);
    } catch (err) {
      alert(JSON.stringify(err));
    }
  }
}

async function calculateApy(asset) {
  const srpb = await Compound.eth.read(
    Compound.util.getAddress('c' + asset),
    'function supplyRatePerBlock() returns (uint256)',
    [],
    { provider: window.ethereum }
  );

  const mantissa = Math.pow(10, 18);
  const blocksPerDay = parseInt(60 * 60 * 24 / 13.15); // ~13.15 second block time
  const daysPerYear = 365;

  const supplyApy = (((Math.pow((+(srpb.toString()) / mantissa * blocksPerDay) + 1, daysPerYear))) - 1) * 100;
  return supplyApy;
}

function getApys(rawRates) {
  const ethMantissa = 1e18;
  const blocksPerDay = 6570; // 13.15 seconds per block
  const daysPerYear = 365;
  const result = {
    days: [],
    rates: [],
  };

  rawRates.forEach((rawRate) => {
    const apy = (((Math.pow((+rawRate.rate / ethMantissa * blocksPerDay) + 1, daysPerYear))) - 1) * 100;
    result.rates.push(apy.toFixed(2));
    result.days.push(rawRate.timestamp.substring(0, 10));
  });

  return result;
}

window.addEventListener('load', async (event) => {
  const ethApy = await calculateApy('ETH');
  ethApyElement.innerText = ethApy.toFixed(2);

  const res = await fetch('http://localhost:8080/rates/thirty/' + Compound.util.getAddress(Compound.cETH));
  const rawRates = await res.json();

  const ratesInApy = getApys(rawRates);

  new Chart(document.getElementById("line-chart"), {
    type: 'line',
    data: {
      labels: ratesInApy.days,
      datasets: [{ 
          data: ratesInApy.rates,
          label: "Percent APY",
          borderColor: "#00D395",
          fill: true
        }
      ]
    },
    options: {
      title: {
        display: true,
        text: 'cETH Interest Rate (APY)'
      }
    }
  });

});
