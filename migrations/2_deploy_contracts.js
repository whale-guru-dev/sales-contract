var CryptoCarbonEnergy = artifacts.require("CryptoCarbonEnergy");
var CyceSale = artifacts.require("CyceSale");

module.exports = function(deployer) {
  // Testnet deploy
  // deployer.deploy(CyceSale, 
  //   "0x04772C8aFEb3bD4173d41feB3d0FC23C9e37af58",
  //   "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
  //   "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  //   "0xb7a4F3E9097C08dA09517b5aB877F7a917224ede"
  //   );
  // Mainnet deploy
  deployer.deploy(CyceSale, 
    "0xEaDD9B69F96140283F9fF75DA5FD33bcF54E6296",
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  );
};