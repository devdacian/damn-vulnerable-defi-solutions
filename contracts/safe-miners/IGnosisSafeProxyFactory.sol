// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/**
  * @title IGnosisSafeProxyFactory
  * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
interface IGnosisSafeProxyFactory {
    function createProxy(address masterCopy, bytes calldata data) external returns (address);
}
