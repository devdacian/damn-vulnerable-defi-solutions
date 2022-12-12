const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] ABI smuggling', function () {
    let deployer, player;
    const VAULT_TOKEN_BALANCE = 1000000n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [ deployer, player ] = await ethers.getSigners();

        // Deploy Damn Valuable Token contract
        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();

        // Deploy Vault
        this.vault = await (await ethers.getContractFactory('SelfAuthorizedVault', deployer)).deploy();

        // Set permissions
        const deployerPermission = await this.vault.getActionId("0x85fb709d", deployer.address, this.vault.address);
        const playerPermission = await this.vault.getActionId("0xd9caed12", player.address, this.vault.address);
        await this.vault.setPermissions([deployerPermission, playerPermission]);
        expect(await this.vault.permissions(deployerPermission)).to.be.true;
        expect(await this.vault.permissions(playerPermission)).to.be.true;

        // Make sure Vault is initialized
        expect(await this.vault.initialized()).to.be.true;

        // Deposit tokens into the vault
        await this.token.transfer(this.vault.address, VAULT_TOKEN_BALANCE);

        expect(await this.token.balanceOf(this.vault.address)).to.eq(VAULT_TOKEN_BALANCE);
        expect(await this.token.balanceOf(player.address)).to.eq(0);

        // Cannot call Vault directly
        await expect(
            this.vault.sweepFunds(deployer.address, this.token.address)
        ).to.be.revertedWith("Bad caller");
        await expect(
            this.vault.connect(player).withdraw(this.token.address, player.address, 10n ** 18n)
        ).to.be.revertedWith("Bad caller");
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        expect(
            await this.token.balanceOf(this.vault.address)
        ).to.eq(0);
        expect(
            await this.token.balanceOf(player.address)
        ).to.eq(VAULT_TOKEN_BALANCE);
    });
});
