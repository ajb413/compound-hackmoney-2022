# HackMoney 2022 Compound Protocol Workshop Demo

This repository contains a very basic UI that uses the Compound Protocol. The app enables users to earn interest on their crypto assets by supplying them to the protocol. Users can also redeem their cTokens.

It also has a back end server that serves historical APY interest rates for a chart in the webpage. The interest rates are cached in a local Sqlite 3 Database.

This app builds on the Compound Hack Money Workshop from last year: https://github.com/ajb413/compound-hackmoney-2021

### Install

Before you run this, get a free Alchemy Ethereum mainnet provider URL with historical access. (https://alchemy.com)

```
git clone https://github.com/ajb413/compound-hackmoney-2022.git
cd compound-hackmoney-2022/
npm install
MAINNET_PROVIDER_URL=alchemy_provider_url_here node index.js

## Web3 app running at http://localhost:8080

```

![Compound Web3 App Screenshot](https://raw.githubusercontent.com/ajb413/compound-hackmoney-2022/master/screenshot.png)
