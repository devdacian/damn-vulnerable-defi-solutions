// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
  * @title Authorizer
  * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
  * @dev To be deployed behind a proxy following the UUPS pattern. Only the owner can upgrade.
 */
contract Authorizer is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    mapping (address => mapping (address => bool)) private guardians;

    event GuardianAdded(address indexed guardian, address account);

    function initialize(address[] memory newGuardians, address[] memory newAccounts) initializer external {
        // initialize inheritance chain
        __Ownable_init();
        __UUPSUpgradeable_init();
        
        // add guardians and wallets
        for (uint256 i = 0; i < newGuardians.length; ) {
            _addGuardian(newGuardians[i], newAccounts[i]);
            unchecked { i++; }
        }
    }

    function _addGuardian(address guardian, address account) private {
        guardians[guardian][account] = true;
        emit GuardianAdded(guardian, account);
    }

    function isAuthorized(address guardian, address account) external view returns (bool) {
        return guardians[guardian][account];
    }

    function upgradeToAndCall(address newImplementation, bytes memory data) external payable override {
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, data, true);
    }

    function _authorizeUpgrade(address newImplementation) internal onlyOwner override {}
}
