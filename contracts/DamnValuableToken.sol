// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

/**
 * @title DamnValuableToken
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract DamnValuableToken is ERC20Permit {
    constructor() ERC20("DamnValuableToken", "DVT") ERC20Permit("DamnValuableToken") {
        _mint(msg.sender, type(uint256).max);
    }
}
