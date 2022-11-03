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
    IGnosisSafeProxyFactory public constant FACTORY = IGnosisSafeProxyFactory(0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B);
    address public constant MASTER_COPY = 0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F;
    address public immutable owner = msg.sender;
    address public immutable token;    
    uint256 public constant PAYMENT_AMOUNT = 1 ether;
    
    address public authorizer;

    error AuthError();

    constructor(address _token) {
        token = _token;
    }

    /**
     * @notice Allows the owner to set an authorizer contract. Can only be called once.
     * @param _authorizer address of the authorizer contract
     */
    function setAuthorizer(address _authorizer) external {
        if(msg.sender != owner || _authorizer == address(0) || authorizer != address(0))
            revert AuthError();

        authorizer = _authorizer;
    }

    /**
     * @notice Allows the caller to deploy a new Safe wallet and receive a payment in return.
     *         If the authorizer is set, the caller must be authorized to execute the deployment.
     * @param data initialization data to be passed to the Safe wallet
     */
    function safeDeploy(bytes memory data) external returns (address) {
        address deploymentAddress = FACTORY.createProxy(MASTER_COPY, data);

        if(authorizer != address(0) && !isAuthorized(msg.sender, deploymentAddress))
            revert AuthError();

        IERC20(token).transfer(msg.sender, PAYMENT_AMOUNT);

        return deploymentAddress;
    }

    function isAuthorized(address deployer, address target) public view returns (bool) {
        assembly {
            let auth := sload(0)
            if iszero(extcodesize(auth)) {
                return(0, 0)
            }

            let pointer := mload(0x40)
            mstore(0x40, add(pointer, 0x44))

            mstore(pointer, shl(0xe0, 0x65e4ad9e))
            mstore(add(pointer, 0x04), deployer)
            mstore(add(pointer, 0x24), target)
            
            if iszero(staticcall(gas(), auth, pointer, 0x44, pointer, 0x20)) {
                return(0, 0)
            }

            if and(
                not(iszero(returndatasize())),
                iszero(mload(pointer))
            ) { return(0, 0) }
        }

        return true;
    }
}
