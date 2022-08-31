// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
  * @title AuthorizerUpgradeable
  * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
  * @dev To be deployed behind a proxy following the UUPS pattern. Upgrades are to be triggered by the owner.
 */
contract AuthorizerUpgradeable is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    mapping (address => mapping (address => bool)) private guardians;

    function initialize(address[] memory newGuardians, address[] memory newWallets) initializer public {
        // initialize inheritance chain
        __Ownable_init();
        __UUPSUpgradeable_init();
        
        // add guardians and wallets
        for (uint i = 0; i < newGuardians.length; ) {
            _addGuardian(newGuardians[i], newWallets[i]);
            unchecked {
                ++i;
            }
        }
    }

    function _addGuardian(address guardian, address wallet) private {
        guardians[guardian][wallet] = true;
    }

    function isAuthorized(address guardian, address wallet) external view returns (bool) {
        return guardians[guardian][wallet];
    }

    function upgradeToAndCall(address newImplementation, bytes memory data) external payable override {
        _authorizeUpgrade(newImplementation); // reverts if not owner
        _upgradeToAndCallUUPS(newImplementation, data, true);
    }

    function _authorizeUpgrade(address newImplementation) internal onlyOwner override {}
}