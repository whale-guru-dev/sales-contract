const MoonFomoETH = artifacts.require("./MoonFomoETH");
const Web3 = require("web3");
const BN = require("bignumber.js")
const { time } = require('openzeppelin-test-helpers');
BN.config({ ROUNDING_MODE: BN.ROUND_DOWN })

async function timeIncreaseTo (seconds) {
    const delay = 1000 - new Date().getMilliseconds();
    await new Promise(resolve => setTimeout(resolve, delay));
    await time.increaseTo(seconds);
}

contract("MoonFomoETH", async accounts => {

  it("should initiate round", async () => {
    let instance = await MoonFomoETH.deployed();
    let startRound = await instance.initRound({ value: "123",from: accounts[0] });
    let curRound = await instance.roundCount();
    assert.equal(curRound.toString(), 1);

    let jackpot = await instance.rounds(1);
    assert.equal(jackpot.jackpot.toString(), 123);
  });

  it("should buy ticket", async () => {
    let instance = await MoonFomoETH.deployed();
    let oldTicketPrice = await instance.calcTicketCost();
    let buyTicket = await instance.buyTicket({value: oldTicketPrice.toString(), from: accounts[1]});
    let userTicketCount = await instance.getTicketsOwned(1, accounts[1]);
    assert.equal(userTicketCount.toString(), 1);
  });

  it("should increase ticket price", async () => {
    let instance = await MoonFomoETH.deployed();
    let oldTicketPrice = await instance.calcTicketCost();
    let buyTicket = await instance.buyTicket({value: oldTicketPrice.toString(), from: accounts[1]});
    let newTicketPrice = await instance.calcTicketCost();
    assert.notEqual(newTicketPrice.toString(), oldTicketPrice.toString());
  });

  it("should increase holder pool", async () => {
    let instance = await MoonFomoETH.deployed();
    let oldRound = await instance.rounds(1);
    let oldTicketPrice = await instance.calcTicketCost();
    let buyTicket = await instance.buyTicket({value: oldTicketPrice.toString(), from: accounts[1]});
    let newRound = await instance.rounds(1);
    assert.notEqual(oldRound.holderPool.toString(), newRound.holderPool.toString());
  });

  it("should increase jackpot", async () => {
    let instance = await MoonFomoETH.deployed();
    let oldRound = await instance.rounds(1);
    let oldTicketPrice = await instance.calcTicketCost();
    let buyTicket = await instance.buyTicket({value: oldTicketPrice.toString(), from: accounts[1]});
    let newRound = await instance.rounds(1);
    assert.notEqual(oldRound.jackpot.toString(), newRound.jackpot.toString());
  });

  it("should increase timer", async () => {
    let instance = await MoonFomoETH.deployed();
    let oldRound = await instance.rounds(1);
    let oldTicketPrice = await instance.calcTicketCost();
    let buyTicket = await instance.buyTicket({value: oldTicketPrice.toString(), from: accounts[1]});
    let newRound = await instance.rounds(1);
    assert.notEqual(oldRound.timer.toString(), newRound.timer.toString());
  });

  it("should pay owner", async () => {
    let instance = await MoonFomoETH.deployed();
    let oldBalance = await web3.eth.getBalance(accounts[0]);
    let oldTicketPrice = await instance.calcTicketCost();
    let buyTicket = await instance.buyTicket({value: oldTicketPrice.toString(), from: accounts[1]});
    let balance = await web3.eth.getBalance(accounts[0]);
    var balanceDifference = new BN(balance).minus(new BN(oldBalance)).toString()
    var holderPoolDifference = new BN(oldTicketPrice.toString()).dividedBy(10).decimalPlaces(0).toString()
    assert.equal(balanceDifference, holderPoolDifference);
  });

  it("should prevent purchase after timer", async () => {
    let instance = await MoonFomoETH.deployed();
    let before = await time.latest();
    await time.increaseTo(+before + 86400);
    let after = await time.latest();

    let curRound = await instance.rounds(1);
    let oldTicketPrice = await instance.calcTicketCost();
    let buyTicket = await instance.buyTicket({value: oldTicketPrice.toString(), from: accounts[1]}).catch((e) => {return ("null")});
    assert.equal(buyTicket, "null");
  });

  it("should prevent create new round", async () => {
    let instance = await MoonFomoETH.deployed();
    let startRound = await instance.initRound({ value: "123",from: accounts[0] }).catch((e) => {return ("null")});
    assert.equal(startRound, "null");
  });

  it("should end round and pay owner +34%", async () => {
    let instance = await MoonFomoETH.deployed();
    let curRound = await instance.rounds(1);
    assert.equal(curRound.ticketCount.toString(), 6);

    let oldBalance = await web3.eth.getBalance(accounts[0]);
    let endRound = await instance.endRound({from: accounts[0]});
    let tx = await web3.eth.getTransaction(endRound.receipt.transactionHash);
    let gasCost = new BN(endRound.receipt.gasUsed.toString()).multipliedBy(new BN(tx.gasPrice.toString()));
    let newBalance = await web3.eth.getBalance(accounts[0]);
    var balanceDifference = new BN(newBalance).minus(new BN(oldBalance)).toString()
    var claimDifference = new BN(curRound.jackpot.toString()).multipliedBy(94).dividedBy(100).minus(gasCost).decimalPlaces(0).toString()
    assert.approximately(+claimDifference, +balanceDifference, 1);
  });

  it("should be claimable", async () => {
    let instance = await MoonFomoETH.deployed();
    let curRound = await instance.rounds(1);
    assert.equal(curRound.ticketCount.toString(), 6);

    let oldBalance = await web3.eth.getBalance(accounts[1]);
    let predictedClaim = await instance.calcPayout(1, accounts[1]);
    let reimbursment = await instance.getClaimList(1, accounts[1]);
    let claimPayout = await instance.claimPayout(1, {from: accounts[1]});
    let tx = await web3.eth.getTransaction(claimPayout.receipt.transactionHash);
    let gasCost = new BN(claimPayout.receipt.gasUsed.toString()).multipliedBy(new BN(tx.gasPrice.toString()));
    let newBalance = await web3.eth.getBalance(accounts[1]);
    var balanceDifference = new BN(newBalance).minus(new BN(oldBalance)).plus(gasCost).toString()
    assert.equal(predictedClaim, balanceDifference);

    let dividendShare = new BN(curRound.holderPool.toString()).dividedBy(6).multipliedBy(6);
    var claimDifference = new BN(curRound.jackpot.toString()).dividedBy(100).multipliedBy(6).plus(dividendShare).plus(new BN(reimbursment.toString())).decimalPlaces(0).toString()
    assert.equal(claimDifference, balanceDifference);
  });

  it("should change ETH and Ticket Cost", async () => {
    let instance = await MoonFomoETH.deployed();
    let setPricing = await instance.setPricing("1000000000000000000", "400", "4000");
    let newEthPrice = await instance.ethPrice();
    let newDollarIncrement = await instance.dollarIncrement();
    let newInitialPrice = await instance.initialPrice();
    assert.equal(newEthPrice.toString(), "400");
    assert.equal(newDollarIncrement.toString(), "4000");
    assert.equal(newInitialPrice.toString(), "1000000000000000000");
  });

  it("should create new round", async () => {
    let instance = await MoonFomoETH.deployed();
    let startRound = await instance.initRound({ value: "123",from: accounts[0] });
    let curRound = await instance.roundCount();
    assert.equal(curRound.toString(), 2);

    let jackpot = await instance.rounds(2);
    assert.equal(jackpot.jackpot.toString(), 123);
  });

  it("should buy 50 tickets", async () => {
    let instance = await MoonFomoETH.deployed();
    for(let x = 0; x < 50; x++){
      var rand = Math.floor(Math.random() * 7) + 1;
      let oldTicketPrice = await instance.calcTicketCost();
      let buyTicket = await instance.buyTicket({value: oldTicketPrice.toString(), from: accounts[rand]});
    }
    var sumOfTickets = 0;
    for(let x = 0; x < 10; x++){
      let userTicketCount = await instance.getTicketsOwned(2, accounts[x]);
      sumOfTickets += +userTicketCount.toString();
    }
    assert.equal(sumOfTickets, 50);
  });

  it("should cost $1.50 after $1,000,000 revenue", async () => {
    let instance = await MoonFomoETH.deployed();
    let curRound = await instance.rounds(2);
    let initialTicketPrice = await instance.initialPrice();
    let oldTicketPrice = await instance.calcTicketCost();
    let priceDifference = new BN(oldTicketPrice).minus(initialTicketPrice);
    let ethPrice = await instance.ethPrice();
    let newDollarIncrement = await instance.dollarIncrement();

    let priceDifferenceUSD = await web3.utils.fromWei(priceDifference.multipliedBy(ethPrice).toFixed(0));
    let ticketPriceETH = await web3.utils.fromWei(new BN(oldTicketPrice).toString())
    let ticketPriceUSD = new BN(ticketPriceETH.toString()).multipliedBy(new BN(ethPrice.toString())).decimalPlaces(2).toString();
    let revenueETH = await web3.utils.fromWei(curRound.holderPool.toString())
    let revenue = new BN(revenueETH.toString()).multipliedBy(new BN(ethPrice.toString())).decimalPlaces(2).toString();
    let proportion = new BN(revenue).div(newDollarIncrement)
    assert.approximately(+priceDifferenceUSD, parseFloat(proportion.toFixed(3)), 0.05);
  });

  it("should end round and pay owner +0%", async () => {
    let instance = await MoonFomoETH.deployed();
    let curRound = await instance.rounds(2);
    assert.equal(curRound.ticketCount.toString(), 50);

    let before = await time.latest();
    await time.increaseTo(+before + 86400);
    let after = await time.latest();

    let oldBalance = await web3.eth.getBalance(accounts[0]);
    let endRound = await instance.endRound({from: accounts[0]});
    let tx = await web3.eth.getTransaction(endRound.receipt.transactionHash);
    let gasCost = new BN(endRound.receipt.gasUsed.toString()).multipliedBy(new BN(tx.gasPrice.toString()));
    let newBalance = await web3.eth.getBalance(accounts[0]);
    var balanceDifference = new BN(newBalance).minus(new BN(oldBalance)).toString()
    var claimDifference = new BN(curRound.jackpot.toString()).dividedBy(100).multipliedBy(60).minus(gasCost).decimalPlaces(0).toString()
    assert.equal(claimDifference, balanceDifference);
  });

});
