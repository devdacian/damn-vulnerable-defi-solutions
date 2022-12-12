// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ExecutionAuthorizer.sol";

/**
 * @title SelfAuthorizedVault
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract SelfAuthorizedVault is ExecutionAuthorizer {

    uint256 public constant WITHDRAWAL_LIMIT = 1 ether;
    uint256 public constant WAITING_PERIOD = 15 days;

    uint256 private _lastWithdrawalTimestamp;

    modifier onlyThis() {
        require(msg.sender == address(this), "Bad caller");
        _;
    }

    constructor() {
        _setLastWithdrawal(block.timestamp);
        _lastWithdrawalTimestamp = block.timestamp;
    }

    // Allows to send a limited amount of tokens to a recipient every now and then
    function withdraw(address tokenAddress, address recipient, uint256 amount) external onlyThis {
        require(amount <= WITHDRAWAL_LIMIT, "Withdrawing too much");
        require(block.timestamp > _lastWithdrawalTimestamp + WAITING_PERIOD, "Try later");
        
        _setLastWithdrawal(block.timestamp);

        IERC20 token = IERC20(tokenAddress);
        require(token.transfer(recipient, amount), "Transfer failed");
    }

    function _beforeFunctionCall(address target, bytes memory) internal view override {
        require(target == address(this), "Bad target");
    }

    function sweepFunds(address receiver, address tokenAddress) external onlyThis {
        IERC20 token = IERC20(tokenAddress);
        require(token.transfer(receiver, token.balanceOf(address(this))), "Transfer failed");
    }

    function getLastWithdrawalTimestamp() external view returns (uint256) {
        return _lastWithdrawalTimestamp;
    }

    function _setLastWithdrawal(uint256 timestamp) internal {
        _lastWithdrawalTimestamp = timestamp;
    }
}
