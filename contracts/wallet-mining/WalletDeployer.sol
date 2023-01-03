// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IGnosisSafeProxyFactory {
    function createProxy(address masterCopy, bytes calldata data) external returns (address);
}

/**
  * @title  WalletDeployer
  * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
  * @notice A contract that allows deployers of Gnosis Safe wallets (v1.1.1) to be rewarded.
  *         Includes an optional authorization mechanism to ensure only expected accounts
  *         are rewarded for certain deployments.
 */
contract WalletDeployer {
    // Addresses of the Gnosis Safe Factory and Master Copy v1.1.1
    IGnosisSafeProxyFactory public constant fact = IGnosisSafeProxyFactory(0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B);
    address public constant copy = 0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F;

    uint256 public constant pay = 1 ether;
    address public immutable chief = msg.sender;
    address public immutable gem;
    
    address public mom;

    error Nope();

    constructor(address _gem) {
        gem = _gem;
    }

    /**
     * @notice Allows the chief to set an authorizer contract. Can only be called once.
     */
    function rule(address _mom) external {
        if (msg.sender != chief || _mom == address(0) || mom != address(0))
            revert Nope();

        mom = _mom;
    }

    /**
     * @notice Allows the caller to deploy a new Safe wallet and receive a payment in return.
     *         If the authorizer is set, the caller must be authorized to execute the deployment.
     * @param wat initialization data to be passed to the Safe wallet
     */
    function drop(bytes memory wat) external returns (address aim) {
        aim = fact.createProxy(copy, wat);

        if (mom != address(0) && !can(msg.sender, aim))
            revert Nope();

        IERC20(gem).transfer(msg.sender, pay);
    }

    function can(address usr, address aim) public view returns (bool) {
        assembly {
            let _mom := sload(0)
            if iszero(extcodesize(_mom)) {
                return(0, 0)
            }
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 0x44))
            mstore(ptr, shl(0xe0, 0x4538c4eb))
            mstore(add(ptr, 0x04), usr)
            mstore(add(ptr, 0x24), aim)
            if iszero(staticcall(gas(), _mom, ptr, 0x44, ptr, 0x20)) {
                return(0, 0)
            }
            if and(not(iszero(returndatasize())), iszero(mload(ptr))) {
                return(0, 0)
            }
        }
        return true;
    }
}
