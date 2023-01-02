// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ExecutionAuthorizer.sol";

/**
 * @title SelfAuthorizedVault
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract SelfAuthorizedVault is ExecutionAuthorizer {
    using SafeERC20 for IERC20;

    uint256 public constant WITHDRAWAL_LIMIT = 1 ether;
    uint256 public constant WAITING_PERIOD = 15 days;

    uint256 private _lastWithdrawalTimestamp;

    error TargetNotAllowed();
    error CallerNotAllowed();
    error WithdrawalAmountAboveLimit();
    error WithdrawalWaitingPeriodNotEnded();

    modifier onlyThis() {
        if(msg.sender != address(this))
            revert CallerNotAllowed();
        _;
    }

    constructor() {
        _setLastWithdrawalTimestamp(block.timestamp);
    }

    /**
     * @notice Allows to send a limited amount of tokens to a recipient every now and then
     * @param tokenAddress address of the token to send
     * @param recipient address of the tokens' recipient
     * @param amount amount of tokens to be transferred 
    */
    function withdraw(address tokenAddress, address recipient, uint256 amount) external onlyThis {
        if(amount > WITHDRAWAL_LIMIT)
            revert WithdrawalAmountAboveLimit();
        if(block.timestamp <= _lastWithdrawalTimestamp + WAITING_PERIOD)
            revert WithdrawalWaitingPeriodNotEnded();
        
        _setLastWithdrawalTimestamp(block.timestamp);

        IERC20(tokenAddress).safeTransfer(recipient, amount);
    }


    function sweepFunds(address receiver, IERC20 token) external onlyThis {
        token.safeTransfer(
            receiver,
            token.balanceOf(address(this))
        );
    }

    function getLastWithdrawalTimestamp() external view returns (uint256) {
        return _lastWithdrawalTimestamp;
    }

    function _beforeFunctionCall(address target, bytes memory) internal view override {
        if(target != address(this))
            revert TargetNotAllowed();
    }

    function _setLastWithdrawalTimestamp(uint256 timestamp) private {
        _lastWithdrawalTimestamp = timestamp;
    }
}
