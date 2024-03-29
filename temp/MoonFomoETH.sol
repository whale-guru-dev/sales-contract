pragma solidity ^0.6.2;

import "./Math/SafeMath.sol";

contract MoonFomoETH {

    using SafeMath for uint256;

    uint256 public roundCount;
    bool public killSwitch;
    uint256 public dollarIncrement = 200000;
    uint256 public initialPrice = 10000000000000000;
    address payable public _owner;

    uint256 constant internal tokenPriceIncremental_ = 0.00000001 ether;

    struct RoundData{
      uint256 timer;
      uint256 ticketCount;
      uint256 jackpot;
      uint256 holderPool;
      mapping(address => uint256) ticketsOwned;
      mapping(address => uint256) claimList;
      mapping(address => uint256) reclaimed;
      mapping(uint256 => address) ticketOwners;
      bool ended;
    }

    mapping(uint256 => RoundData) public rounds;
    mapping(uint256 => uint256) public jackpotClaimed;

    event RoundStarted(uint256 round, uint256 endingTime);
    event TicketBought(address buyer, uint256 ticketNumber, uint256 ticketAmount);
    event RoundEnded(uint256 round, uint256 jackpot, uint256 tickets);
    event TicketClaimed(uint256 round, address buyer, uint256 claimAmount);
    event DividendClaimed(uint256 round, address claimant, uint256 dividendAmount);

    modifier onlyOwner() {
        require(msg.sender == _owner, "Not Owner");
        _;
    }

    constructor(address payable owner_) public {
      _owner = owner_;
    }

    /// Starts a round and adds transaction to jackpot
    /// @dev increments round count, initiates timer and loads jackpot
    function initRound() external payable onlyOwner {
      require(roundCount == 0 || rounds[roundCount].ended, "Previous Round Not Ended!");

      roundCount++;
      rounds[roundCount].jackpot += msg.value;
      rounds[roundCount].timer = now + 10 hours;

      emit RoundStarted(roundCount, rounds[roundCount].timer);
    }

    /// Starts a round and adds transaction to jackpot
    /// @dev increments round count, initiates timer and loads jackpot
    function setPricing(uint256 _initialPrice, uint256 _dollarIncrement) external onlyOwner {
      require(rounds[roundCount].timer < now, "Previous Round Not Ended!");

      initialPrice = _initialPrice;
      dollarIncrement = _dollarIncrement;
    }

    /// Calculate owner of ticket
    /// @dev calculates ticket owner
    /// @param _round the round to query
    /// @param _ticketIndex the ticket to query
    /// @return owner of ticket
    function getTicketOwner(uint256 _round, uint256 _ticketIndex) public view returns(address) {
      return rounds[_round].ticketOwners[_ticketIndex];
    }

    /// Calculate tickets owned by user
    /// @dev calculates tickets owned by user
    /// @param _round the round to query
    /// @param _user the user to query
    /// @return total tickets owned by user
    function getTicketsOwned(uint256 _round, address _user) public view returns(uint256) {
      return rounds[_round].ticketsOwned[_user];
    }

    /// Get ticket reimbursment amount by user
    /// @dev calculates returnable ticket cost to user
    /// @param _round the round to query
    /// @param _user the user to query
    /// @return ticket reimbursment amount for user
    function getClaimList(uint256 _round, address _user) public view returns(uint256) {
      return rounds[_round].claimList[_user];
    }

    /// Get dividends claimed user
    /// @dev calculates returnable ticket cost to user
    /// @param _round the round to query
    /// @param _user the user to query
    /// @return dividend claimed by user
    function getReclaim(uint256 _round, address _user) public view returns(uint256) {
      return rounds[_round].reclaimed[_user];
    }

    /// Calculate ticket cost
    /// @dev calculates ticket price based on current holder pool
    /// @return sumCost current cost of tickets
    function calcTicketCost(uint256 _amount) public view returns(uint256 sumCost) {
      uint additionalPool = 0;
      uint256 holderPool = rounds[roundCount].holderPool;
      for(uint256 x = 0; x < _amount; x++){
        sumCost += initialPrice + holderPool.add(additionalPool).div(dollarIncrement);
        additionalPool = sumCost.div(10);
      }
    }

    /// Buy a ticket
    /// @dev purchases a ticket and distributes funds
    /// @return ticket index
    function buyTicket(uint256 _amount) external payable returns(uint256){
      uint256 ticketPrice = calcTicketCost(_amount);
      require(msg.value >= ticketPrice, "Insufficient ETH Sent!");
      require(rounds[roundCount].timer > now, "Round Ended!");

      rounds[roundCount].jackpot += ticketPrice.div(10);
      rounds[roundCount].holderPool += ticketPrice.div(10);
      (bool success, ) = _owner.call.value(ticketPrice.div(10))("");
      require(success);

      rounds[roundCount].ticketsOwned[msg.sender] += _amount;
      rounds[roundCount].claimList[msg.sender] += ticketPrice.sub(ticketPrice.div(10).mul(3));
      for(uint256 x = 0; x < _amount; x++){
        rounds[roundCount].ticketOwners[rounds[roundCount].ticketCount] = msg.sender;
        rounds[roundCount].ticketCount++;
      }
      if(!killSwitch){
        rounds[roundCount].timer += 15 * _amount;
      }

      if(msg.value > ticketPrice){
        (bool reimburse, ) = msg.sender.call.value(msg.value.sub(ticketPrice))("");
        require(reimburse);
      }

      emit TicketBought(msg.sender, rounds[roundCount].ticketCount, _amount);
      return rounds[roundCount].ticketCount;
    }

    /// Enable/Disable kill switch
    /// @dev toggles the kill switch, preventing additional time
    function toggleKill() external onlyOwner {
      killSwitch = !killSwitch;
    }

    /// End the current round
    /// @dev concludes round and pays owner
    function endRound() external {
      require(rounds[roundCount].timer < now, "Round Not Finished!");
      require(!rounds[roundCount].ended, "Round Already Ended!");

      uint256 totalClaim = rounds[roundCount].jackpot.mul(6).div(10);
      uint256 ticketLength = 40;
      if(rounds[roundCount].ticketCount < 40){
        ticketLength = rounds[roundCount].ticketCount;
      }
      totalClaim += rounds[roundCount].jackpot.mul(uint256(40).sub(ticketLength)).div(100);
      jackpotClaimed[roundCount] += totalClaim;

      (bool success, ) = _owner.call.value(totalClaim)("");
      require(success);
      rounds[roundCount].ended = true;
      emit RoundEnded(roundCount, rounds[roundCount].jackpot, rounds[roundCount].ticketCount);
    }

    /// Calculate total dividends for a round
    /// @param _round the round to query
    /// @param _ticketHolder the user to query
    /// @dev calculates dividends minus reinvested funds
    /// @return totalDividends total dividends
    function calcDividends(uint256 _round, address _ticketHolder) public view returns(uint256 totalDividends) {
      if(rounds[_round].ticketCount == 0){
        return 0;
      }
      totalDividends = rounds[_round].ticketsOwned[_ticketHolder].mul(rounds[_round].holderPool).div(rounds[_round].ticketCount);
      totalDividends = totalDividends.sub(rounds[_round].reclaimed[_ticketHolder]);
      return totalDividends;
    }

    /// Calculate total payout for a round
    /// @param _round the round to claim
    /// @param _ticketHolder the user to query
    /// @dev calculates jackpot earnings, dividends and ticket reimbursment
    /// @return totalClaim total claim
    function calcPayout(uint256 _round, address _ticketHolder) public view returns(uint256 totalClaim, uint256 jackpot) {
      if(rounds[_round].claimList[_ticketHolder] == 0){
        return (0, 0);
      }
      totalClaim = calcDividends(_round, _ticketHolder);
      uint256 percentageCount;
      uint256 ticketLength = 40;
      if(rounds[_round].ticketCount < 40){
        ticketLength = rounds[_round].ticketCount;
      }
      for(uint256 x = rounds[_round].ticketCount - ticketLength; x < rounds[_round].ticketCount; x++){
        if(rounds[_round].ticketOwners[x] == _ticketHolder){
          percentageCount++;
        }
      }
      jackpot = rounds[_round].jackpot.mul(percentageCount).div(100);
      totalClaim += jackpot;
      totalClaim += rounds[_round].claimList[_ticketHolder];
      return (totalClaim, jackpot);
    }

    /// Claim total dividends and winnings earned for a round
    /// @param _round the round to claim
    /// @dev calculates payout and pays user
    function claimPayout(uint256 _round) external {
      require(rounds[_round].timer < now, "Round Not Ended!");
      require(rounds[_round].claimList[msg.sender] > 0, "You Have Already Claimed!");

      (uint256 payout, uint256 jackpot) = calcPayout(_round, msg.sender);
      (bool success, ) = msg.sender.call.value(payout)("");
      require(success);

      jackpotClaimed[_round] += jackpot;
      rounds[_round].claimList[msg.sender] = 0;

      emit TicketClaimed(_round, msg.sender, payout);
    }

    /// Claim total dividends in the current round
    /// @param _amount the amount to claim
    /// @dev calculates payout and pays user
    function claimDividends(uint256 _amount) external{
      require(calcDividends(roundCount, msg.sender) >= _amount, "Insufficient Dividends Available!");

      rounds[roundCount].reclaimed[msg.sender] += _amount;
      (bool success, ) = msg.sender.call.value(_amount)("");
      require(success);

      emit DividendClaimed(roundCount, msg.sender, _amount);
    }

    /// Buy a ticket with dividends
    /// @dev purchases a ticket with dividends and distributes funds
    /// @return ticket index
    function reinvestDividends(uint256 _amount) external returns(uint256){
      require(calcDividends(roundCount, msg.sender) >= calcTicketCost(_amount), "Insufficient Dividends Available!");
      require(rounds[roundCount].timer > now, "Round Ended!");

      uint256 ticketPrice = calcTicketCost(_amount);
      rounds[roundCount].jackpot += ticketPrice.div(10);
      rounds[roundCount].holderPool += ticketPrice.div(10);
      (bool success, ) = _owner.call.value(ticketPrice.div(10))("");
      require(success);

      rounds[roundCount].ticketsOwned[msg.sender] += _amount;
      rounds[roundCount].reclaimed[msg.sender] += ticketPrice;
      rounds[roundCount].claimList[msg.sender] += ticketPrice.sub(ticketPrice.div(10).mul(3));
      for(uint256 x = 0; x < _amount; x++){
        rounds[roundCount].ticketOwners[rounds[roundCount].ticketCount] = msg.sender;
        emit TicketBought(msg.sender, rounds[roundCount].ticketCount, _amount);
        rounds[roundCount].ticketCount++;
      }

      if(!killSwitch){
        rounds[roundCount].timer += 15 * _amount;
      }

      return(rounds[roundCount].ticketCount);
    }

}
