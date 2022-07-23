# Changelog

## v2.3.0

- Migrate from Waffle to Hardhat Chai Matchers (following [this guide](https://hardhat.org/hardhat-chai-matchers/docs/migrate-from-waffle))
- Update and pin dependencies
- Change final assertion in Puppet challenge [following PR#9](https://github.com/tinchoabbate/damn-vulnerable-defi/pull/9).
- Remove unnecessary `await`s in The Rewarder challenge [following PR#12](https://github.com/tinchoabbate/damn-vulnerable-defi/pull/12)
- Update WETH9 to Solidity 0.8.0 [following PR#5](https://github.com/tinchoabbate/damn-vulnerable-defi/pull/5)
- Change timestamp comparison in `ClimberTimelock` contract [following PR#16](https://github.com/tinchoabbate/damn-vulnerable-defi/pull/16) and additional refactors.
- Improve error messages to ease debugging.

## v2.2.0

- Change name of challenge "Junior Miners" to "Safe Miners".

## v2.1.0

- New level: Junior Miners.

## v2.0.0

- Refactor testing environment. Now using Hardhat, Ethers and Waffle. This should give players a better debugging experience, and allow them to familiarize with up-to-date JavaScript tooling for smart contract testing.
- New levels:
    - Backdoor
    - Climber
    - Free Rider
    - Puppet v2
- New integrations with Gnosis Safe wallets, Uniswap v2, WETH9 and the upgradebale version of OpenZeppelin Contracts.
- Tweaks in existing challenges after community feedback
    - Upgraded most contracts to Solidity 0.8
    - Changes in internal libraries around low-level calls and transfers of ETH. Now mostly using OpenZeppelin Contracts utilities.
    - In existing Puppet and The Rewarder challenges, better encapsulate issues to avoid repetitions.
    - Reorganization of some files
- Changed from `npm` to `yarn` as dependency manager

## v1.0.0

Initial version
