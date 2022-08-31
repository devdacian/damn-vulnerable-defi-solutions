// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./AuthorizerUpgradeable.sol";
import "./IGnosisSafeProxyFactory.sol";

/**
  * @title SafeDeployer
  * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
  * @notice A contract that allows deployers of Gnosis Safe (v1.1.1) to be paid.
  *         Includes an optional authorization mechanism to ensure only expected accounts
  *         are paid for certain deployments.
 */
contract SafeDeployer {
    // Addresses of the Gnosis Safe Factory and Master Copy v1.1.1
    IGnosisSafeProxyFactory public constant FACTORY = IGnosisSafeProxyFactory(0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B);
    address public constant MASTER_COPY = 0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F;

    // Amount of tokens to be paid to deployers that call `safeDeploy`
    uint256 public constant PAYMENT_AMOUNT = 10 ether;

    IERC20 public immutable token;
    address public immutable owner = msg.sender;    
    AuthorizerUpgradeable public authorizer;

    constructor(address _token) {
        token = IERC20(_token);
    }

    /**
     * @notice Allows the owner to set an authorizer contract. Can only be called once.
     */
    function setAuthorizer(address _authorizer) external {
        require(
            msg.sender == owner &&
            address(authorizer) == address(0) &&
            _authorizer != address(0)
        );
        authorizer = AuthorizerUpgradeable(_authorizer);
    }

    /**
     * @notice Allows the caller to deploy a new Safe wallet and receive a payment in return.
     *         If the authorizer is set, the caller must be authorized to execute the deployment.
     * @param data initialization data to be passed to the Safe wallet
     */
    function safeDeploy(bytes memory data) external returns (address deploymentAddress) {
        deploymentAddress = FACTORY.createProxy(
            MASTER_COPY,
            data
        );

        // if authorizer has been set, must use it
        if(isAuthorizerSet()) {
            _authorize(msg.sender, deploymentAddress);
        }
        
        if (token.balanceOf(address(this)) >= PAYMENT_AMOUNT) {
            require(token.transfer(msg.sender, PAYMENT_AMOUNT), "Token transfer failed");
        }
    }

    function isAuthorizerSet() public view returns (bool) {
        return address(authorizer) != address(0);
    }

    function _authorize(address guardian, address wallet) private view {
        address target = address(authorizer);
        assembly {
            if eq(extcodesize(target), 0) {
                revert(0, 0)
            }
        }

        (bool success, bytes memory returndata) = target.staticcall(abi.encodeWithSelector(
            AuthorizerUpgradeable.isAuthorized.selector,
            guardian,
            wallet
        ));
        require(success, "Authorization call failed");
        if (returndata.length > 0) {
            require(abi.decode(returndata, (bool)), "Not authorized");
        }
    }
}
