const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Truster', function () {
    let deployer, player;

    const TOKENS_IN_POOL = 1000000n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, player] = await ethers.getSigners();

        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        this.pool = await (await ethers.getContractFactory('TrusterLenderPool', deployer)).deploy(this.token.address);
        expect(await this.pool.token()).to.eq(this.token.address);

        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);
        expect(await this.token.balanceOf(this.pool.address)).to.equal(TOKENS_IN_POOL);

        expect(await this.token.balanceOf(player.address)).to.equal(0);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

        // Player has taken all tokens from the pool
        expect(
            await this.token.balanceOf(player.address)
        ).to.equal(TOKENS_IN_POOL);
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal(0);
    });
});

