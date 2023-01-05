const { ethers } = require('hardhat');
const { expect } = require('chai');
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe('[Challenge] Selfie', function () {
    let deployer, player;

    const TOKEN_INITIAL_SUPPLY = 2000000n * 10n ** 18n;
    const TOKENS_IN_POOL = 1500000n * 10n ** 18n;
    
    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, player] = await ethers.getSigners();

        // Deploy Damn Valuable Token Snapshot
        this.token = await (await ethers.getContractFactory('DamnValuableTokenSnapshot', deployer)).deploy(TOKEN_INITIAL_SUPPLY);

        // Deploy governance contract
        this.governance = await (await ethers.getContractFactory('SimpleGovernance', deployer)).deploy(this.token.address);
        expect(await this.governance.getActionCounter()).to.eq(1);

        // Deploy the pool
        this.pool = await (await ethers.getContractFactory('SelfiePool', deployer)).deploy(
            this.token.address,
            this.governance.address    
        );
        expect(await this.pool.token()).to.eq(this.token.address);
        expect(await this.pool.governance()).to.eq(this.governance.address);
        
        // Fund the pool
        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);
        await this.token.snapshot();
        expect(await this.token.balanceOf(this.pool.address)).to.be.equal(TOKENS_IN_POOL);
        expect(await this.pool.maxFlashLoan(this.token.address)).to.eq(TOKENS_IN_POOL);
        expect(await this.pool.flashFee(this.token.address, 0)).to.eq(0);

    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

        // Player has taken all tokens from the pool
        expect(
            await this.token.balanceOf(player.address)
        ).to.be.equal(TOKENS_IN_POOL);        
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.be.equal(0);
    });
});
