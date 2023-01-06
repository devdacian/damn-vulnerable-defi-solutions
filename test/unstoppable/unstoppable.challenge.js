const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Unstoppable', function () {
    let deployer, player, someUser;

    const TOKENS_IN_VAULT = 1000000n * 10n ** 18n;
    const INITIAL_PLAYER_TOKEN_BALANCE = 10n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */

        [deployer, player, someUser] = await ethers.getSigners();

        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        this.vault = await (await ethers.getContractFactory('UnstoppableVault', deployer)).deploy(
            this.token.address,
            deployer.address, // owner
            deployer.address // fee recipient
        );
        expect(await this.vault.asset()).to.eq(this.token.address);

        await this.token.approve(this.vault.address, TOKENS_IN_VAULT);
        await this.vault.deposit(TOKENS_IN_VAULT, deployer.address);

        expect(await this.token.balanceOf(this.vault.address)).to.eq(TOKENS_IN_VAULT);
        expect(await this.vault.totalAssets()).to.eq(TOKENS_IN_VAULT);
        expect(await this.vault.totalSupply()).to.eq(TOKENS_IN_VAULT);
        expect(await this.vault.maxFlashLoan(this.token.address)).to.eq(TOKENS_IN_VAULT);
        expect(await this.vault.flashFee(this.token.address, TOKENS_IN_VAULT - 1n)).to.eq(0);
        expect(
            await this.vault.flashFee(this.token.address, TOKENS_IN_VAULT)
        ).to.eq(50000n * 10n ** 18n);

        await this.token.transfer(player.address, INITIAL_PLAYER_TOKEN_BALANCE);
        expect(await this.token.balanceOf(player.address)).to.eq(INITIAL_PLAYER_TOKEN_BALANCE);

        // Show it's possible for someUser to take out a flash loan
        this.receiverContract = await (await ethers.getContractFactory('ReceiverUnstoppable', someUser)).deploy(
            this.vault.address
        );
        await this.receiverContract.executeFlashLoan(100n * 10n ** 18n);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

        // It is no longer possible to execute flash loans
        await expect(
            this.receiverContract.executeFlashLoan(100n * 10n ** 18n)
        ).to.be.reverted;
    });
});
