# Changelog

## v2.0.0

- Change testing environment. Now we're using Hardhat, Ethers and Waffle. This should give players a better debugging experience, and allow them to familiarize with up-to-date JavaScript tooling for smart contract testing.
- New levels:
    - Backdoor
    - Climber
- New integrations with Gnosis Safe wallets, Uniswap v2, WETH9 and the upgradebale version of OpenZeppelin Contracts.
- Tweaks in existing challenges after community feedback
    - Upgraded most contracts to Solidity 0.8
    - Changes in internal libraries around low-level calls and transfers of ETH. Now mostly using OpenZeppelin Contracts utilities.
    - In Puppet and The Rewarder challenges, better encapsulate issues to avoid repetitions.
    - Reorganization of some files

## v1.0.0

Initial version
