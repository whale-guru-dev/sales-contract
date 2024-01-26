const MoonFomoETH = artifacts.require("MoonFomoV1");
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
    let oldTicketPrice = await instance.calcTicketCost(1);
    let buyTicket = await instance.buyTicket(1, {value: oldTicketPrice.toString(), from: accounts[1]});
    let userTicketCount = await instance.getTicketsOwned(1, accounts[1]);
    //assert.equal(userTicketCount.toString(), 1);
  });

  it("should increase ticket price", async () => {
    let instance = await MoonFomoETH.deployed();
    let oldTicketPrice = await instance.calcTicketCost(1);
    let buyTicket = await instance.buyTicket(1, {value: oldTicketPrice.toString(), from: accounts[1]});
    let newTicketPrice = await instance.calcTicketCost(1);
    assert.notEqual(newTicketPrice.toString(), oldTicketPrice.toString());
  });

  it("should increase holder pool", async () => {
    let instance = await MoonFomoETH.deployed();
    let oldRound = await instance.rounds(1);
    let oldTicketPrice = await instance.calcTicketCost(1);
    let buyTicket = await instance.buyTicket(1, {value: oldTicketPrice.toString(), from: accounts[1]});
    let newRound = await instance.rounds(1);
    assert.notEqual(oldRound.holderPool.toString(), newRound.holderPool.toString());
  });
/*
  it("should increase my dividends", async () => {
    let instance = await MoonFomoETH.deployed();
    //console.log(assert)
    for(let x = 0; x < 10; x++){
      let oldDividends = await instance.calcDividends(1, accounts[1], {from: accounts[1]});
      let oldTicketPrice = await instance.calcTicketCost(10);
      let buyTicket = await instance.buyTicket(10, {value: oldTicketPrice.toString(), from: accounts[2]});
      let newDividends = await instance.calcDividends(1, accounts[1], {from: accounts[1]});
      console.log(web3.utils.fromWei(oldDividends.toString()), web3.utils.fromWei(newDividends.toString()));
      assert.isBelow(+(oldDividends.toString()), +(newDividends.toString()));
    }
  });*/

  it("should increase jackpot", async () => {
    let instance = await MoonFomoETH.deployed();
    let oldRound = await instance.rounds(1);
    let oldTicketPrice = await instance.calcTicketCost(2);
    let buyTicket = await instance.buyTicket(2, {value: oldTicketPrice.toString(), from: accounts[1]});
    let newRound = await instance.rounds(1);
    assert.notEqual(oldRound.jackpot.toString(), newRound.jackpot.toString());
  });

  it("should increase timer", async () => {
    let instance = await MoonFomoETH.deployed();
    let oldRound = await instance.rounds(1);
    let oldTicketPrice = await instance.calcTicketCost(1);
    let buyTicket = await instance.buyTicket(1, {value: oldTicketPrice.toString(), from: accounts[1]});
    let newRound = await instance.rounds(1);
    assert.notEqual(oldRound.timer.toString(), newRound.timer.toString());
  });

  it("should pay owner", async () => {
    let instance = await MoonFomoETH.deployed();
    let oldBalance = await web3.eth.getBalance(accounts[0]);
    let oldTicketPrice = await instance.calcTicketCost(1);
    let buyTicket = await instance.buyTicket(1, {value: oldTicketPrice.toString(), from: accounts[1]});
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
    let oldTicketPrice = await instance.calcTicketCost(1);
    let buyTicket = await instance.buyTicket(1, {value: oldTicketPrice.toString(), from: accounts[1]}).catch((e) => {return ("null")});
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
    //assert.equal(curRound.ticketCount.toString(), 7);

    let oldBalance = await web3.eth.getBalance(accounts[0]);
    let endRound = await instance.endRound({from: accounts[0]});
    let tx = await web3.eth.getTransaction(endRound.receipt.transactionHash);
    let gasCost = new BN(endRound.receipt.gasUsed.toString()).multipliedBy(new BN(tx.gasPrice.toString()));
    let newBalance = await web3.eth.getBalance(accounts[0]);
    var balanceDifference = new BN(newBalance).minus(new BN(oldBalance)).toString()
    var claimDifference = new BN(curRound.jackpot.toString()).multipliedBy(93).dividedBy(100).minus(gasCost).decimalPlaces(0).toString()
    assert.approximately(+claimDifference, +balanceDifference, 1);
  });

  it("should be claimable", async () => {
    let instance = await MoonFomoETH.deployed();
    let curRound = await instance.rounds(1);
    //assert.equal(curRound.ticketCount.toString(), 7);

    let oldBalance = await web3.eth.getBalance(accounts[1]);
    let predictedClaim = await instance.calcPayout(1, accounts[1]);
    let reimbursment = await instance.getClaimList(1, accounts[1]);
    let claimPayout = await instance.claimPayout(1, {from: accounts[1]});
    let tx = await web3.eth.getTransaction(claimPayout.receipt.transactionHash);
    let gasCost = new BN(claimPayout.receipt.gasUsed.toString()).multipliedBy(new BN(tx.gasPrice.toString()));
    let newBalance = await web3.eth.getBalance(accounts[1]);
    var balanceDifference = new BN(newBalance).minus(new BN(oldBalance)).plus(gasCost).toString()
    assert.equal(predictedClaim, balanceDifference);

    let dividendShare = new BN(curRound.holderPool.toString()).dividedBy(7).multipliedBy(7);
    var claimDifference = new BN(curRound.jackpot.toString()).dividedBy(100).multipliedBy(7).plus(dividendShare).plus(new BN(reimbursment.toString())).decimalPlaces(0).toString()
    assert.equal(claimDifference, balanceDifference);
  });

  it("should pay claims and reduce balance to 0", async () => {
    let instance = await MoonFomoETH.deployed();
    for(let x = 0; x < 10; x++){
      let claim1 = await instance.claimPayout(1, {from: accounts[x]}).catch((e) => {return null});
    }
    var balance = await web3.eth.getBalance(instance.address);
    assert.approximately(parseInt(balance), 0, 20);
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
    for(let x = 0; x < 10; x++){
      var rand = Math.floor(Math.random() * 7) + 1;
      let oldTicketPrice = await instance.calcTicketCost(5);
      let buyTicket = await instance.buyTicket(5, {value: oldTicketPrice.toString(), from: accounts[rand]});
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
    let oldTicketPrice = await instance.calcTicketCost(1);
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


  it("should claim dividends", async () => {
    let instance = await MoonFomoETH.deployed();
    let totalDivsBefore = await instance.calcDividends(2, accounts[2]);
    var amount = 100000000
    let reinvest = await instance.claimDividends(amount, {value: 0, from: accounts[2]});
    let totalDivsAfter = await instance.calcDividends(2, accounts[2]);

    assert.equal(totalDivsAfter.toString(), new BN(totalDivsBefore).minus(amount).toString());
  });

  it("should buy a ticket with dividends", async () => {
    let instance = await MoonFomoETH.deployed();
    for(let x = 0; x < 10; x++){
      let oldTicketPrice = await instance.calcTicketCost(5);
      let buyTicket = await instance.buyTicket(5, {value: oldTicketPrice.toString(), from: accounts[1]});
    }
    let totalDivsBefore = await instance.calcDividends(2, accounts[1]);
    let ticketsBefore = await instance.getTicketsOwned(2, accounts[1]);
    let newTicketPrice = await instance.calcTicketCost(2);
    let buyTicket = await instance.reinvestDividends(2, {value: 0, from: accounts[1]});
    let totalDivsAfter = await instance.calcDividends(2, accounts[1]);
    let ticketsAfter = await instance.getTicketsOwned(2, accounts[1]);
    let curRound = await instance.rounds(2);
    let reclaim = await instance.getReclaim(2, accounts[1]);
    let newDiv = new BN(ticketsAfter).multipliedBy(curRound.holderPool).dividedBy(curRound.ticketCount).minus(reclaim);

    assert.equal(totalDivsAfter.toString(), new BN(newDiv).toFixed(0))
    assert.equal(ticketsAfter.toString(), +ticketsBefore.toString() +  2);
  });

  it("should end round and pay owner +0%", async () => {
    let instance = await MoonFomoETH.deployed();
    let curRound = await instance.rounds(2);
    //assert.equal(curRound.ticketCount.toString(), 61);
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

  it("should pay claims and reduce balance to 0", async () => {
    let instance = await MoonFomoETH.deployed();
    for(let x = 0; x < 10; x++){
      let claim1 = await instance.claimPayout(1, {from: accounts[x]}).catch((e) => {return null});
      let claim2 = await instance.claimPayout(2, {from: accounts[x]}).catch((e) => {return null});
    }
    var balance = await web3.eth.getBalance(instance.address);
    assert.approximately(parseInt(balance), 0, 20);
  });

  it("should create new round, buy 3 tickets, buy 1000 tickets, show figures", async () => {
    let instance = await MoonFomoETH.deployed();
    let setPricing = await instance.setPricing("260000000000000", "400", "200000");
    let startRound = await instance.initRound({ value: "100000000000000000",from: accounts[0] });
    let curRound = await instance.roundCount();
    console.log("CURRENT ROUND : ", curRound.toString());
    assert.equal(curRound.toString(), 3);

    let jackpot = await instance.rounds(3);
    //assert.equal(jackpot.jackpot.toString(), 0);

    let oldTicketPrice = await instance.calcTicketCost(3);
    let oldPrice = await instance.calcTicketCost(1);
    
    let buyTicket = await instance.buyTicket(3, {value: oldTicketPrice.toString(), from: accounts[8]});
    let userTicketCount = await instance.getTicketsOwned(3, accounts[8]);
    let newTicketPrice = await instance.calcTicketCost(1);
    let dividends1 = await instance.calcDividends(3, accounts[8]);
    let payouts1 = await instance.calcPayout(3, accounts[8]);
    console.log("USER 1 OWNS", userTicketCount.toString() ,"TICKETS")
    console.log("USER DIVIDENDS: ", web3.utils.fromWei(dividends1.toString()), "ETH")
    console.log("USER PAYOUTS: ", web3.utils.fromWei(payouts1.toString()), "ETH")
    console.log("OLD TICKET PRICE IS : ", web3.utils.fromWei(oldPrice.toString()), "ETH");
    console.log("NEW TICKET PRICE IS: ", web3.utils.fromWei(newTicketPrice.toString()), "ETH")

    let evenNewerTicketPrice = await instance.calcTicketCost(100);
    let buyTicketAnother = await instance.buyTicket(100, {value: evenNewerTicketPrice.toString(), from: accounts[9], gas: "5500000"});
    let payouts2 = await instance.calcPayout(3, accounts[8]);
    let dividends2 = await instance.calcDividends(3, accounts[8]);
    console.log("USER PAYOUTS: ", web3.utils.fromWei(payouts2.toString()), "ETH")
    console.log("USER DIVIDENDS: ", web3.utils.fromWei(dividends2.toString()), "ETH")

    let evenNewerTicketPrice1 = await instance.calcTicketCost(100);
    let buyTicketAnother1 = await instance.buyTicket(100, {value: evenNewerTicketPrice1.toString(), from: accounts[7], gas: "5500000"});
    let payouts3 = await instance.calcPayout(3, accounts[8]);
    let dividends3 = await instance.calcDividends(3, accounts[8]);
    console.log("USER PAYOUTS: ", web3.utils.fromWei(payouts3.toString()), "ETH")
    console.log("USER DIVIDENDS: ", web3.utils.fromWei(dividends3.toString()), "ETH")

    let evenNewerTicketPrice2 = await instance.calcTicketCost(100);
    let buyTicketAnother2 = await instance.buyTicket(100, {value: evenNewerTicketPrice2.toString(), from: accounts[6], gas: "5500000"});

    let evenNewerTicketPrice3 = await instance.calcTicketCost(100);
    let buyTicketAnother3 = await instance.buyTicket(100, {value: evenNewerTicketPrice3.toString(), from: accounts[5], gas: "5500000"});

    let evenNewerTicketPrice4 = await instance.calcTicketCost(100);
    let buyTicketAnother4 = await instance.buyTicket(100, {value: evenNewerTicketPrice4.toString(), from: accounts[4], gas: "5500000"});

    let evenNewerTicketPrice5 = await instance.calcTicketCost(100);
    let buyTicketAnother5 = await instance.buyTicket(100, {value: evenNewerTicketPrice5.toString(), from: accounts[3], gas: "5500000"});

    let evenNewerTicketPrice6 = await instance.calcTicketCost(100);
    let buyTicketAnother6 = await instance.buyTicket(100, {value: evenNewerTicketPrice6.toString(), from: accounts[2], gas: "5500000"});

    let evenNewerTicketPrice7 = await instance.calcTicketCost(100);
    let buyTicketAnother7 = await instance.buyTicket(100, {value: evenNewerTicketPrice7.toString(), from: accounts[1], gas: "5500000"});

    let evenNewerTicketPrice8 = await instance.calcTicketCost(100);
    let buyTicketAnother8 = await instance.buyTicket(100, {value: evenNewerTicketPrice8.toString(), from: accounts[9], gas: "5500000"});

    let evenNewerTicketPrice9 = await instance.calcTicketCost(100);
    let buyTicketAnother9 = await instance.buyTicket(100, {value: evenNewerTicketPrice9.toString(), from: accounts[8], gas: "5500000"});
    let payouts4 = await instance.calcPayout(3, accounts[8]);
    let dividends4 = await instance.calcDividends(3, accounts[8]);
    console.log("USER PAYOUTS: ", web3.utils.fromWei(payouts4.toString()), "ETH")

    let userTicketCount2 = await instance.getTicketsOwned(3, accounts[9]);
    let finalTicketPrice = await instance.calcTicketCost(1);
    console.log("USER 2 OWNS", userTicketCount2.toString() ,"TICKETS")
    console.log("NEW TICKET PRICE IS: ", web3.utils.fromWei(finalTicketPrice.toString()), "ETH")

    console.log("")
    let dividendsNew = await instance.calcDividends(3, accounts[8]);
    let round = await instance.rounds(3);
    console.log("JACKPOT: ", web3.utils.fromWei(round.jackpot.toString()), "ETH")
    console.log("DIVS: ", web3.utils.fromWei(round.holderPool.toString()), "ETH")
    console.log("TOTAL TICKETS: ", round.ticketCount.toString())
    console.log("USER 1 DIVIDENDS: ", web3.utils.fromWei(dividendsNew.toString()), "ETH")


  });

  it("should end round and pay owner +0%", async () => {
    let instance = await MoonFomoETH.deployed();
    let curRound = await instance.rounds(3);
    //assert.equal(curRound.ticketCount.toString(), 61);
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
