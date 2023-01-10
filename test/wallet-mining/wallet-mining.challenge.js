const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Wallet mining', function () {
    let deployer, player;
    
    const DEPOSIT_ADDRESS = '0x9b6fb606a9f5789444c17768c6dfcf2f83563801';
    const DEPOSIT_TOKEN_AMOUNT = 20000000n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [ deployer, guardian, player ] = await ethers.getSigners();

        // Deploy Damn Valuable Token contract
        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();

        // Deploy authorizer with the corresponding proxy
        this.authorizer = await upgrades.deployProxy(
            await ethers.getContractFactory('AuthorizerUpgradeable', deployer),
            [ [ guardian.address ], [ DEPOSIT_ADDRESS ] ], // initialization data
            { kind: 'uups', initializer: 'init' }
        );
        
        expect(await this.authorizer.owner()).to.eq(deployer.address);
        expect(await this.authorizer.can(guardian.address, DEPOSIT_ADDRESS)).to.be.true;
        expect(await this.authorizer.can(player.address, DEPOSIT_ADDRESS)).to.be.false;

        // Deploy Safe Deployer contract
        this.walletDeployer = await (await ethers.getContractFactory('WalletDeployer', deployer)).deploy(
            this.token.address
        );
        expect(await this.walletDeployer.chief()).to.eq(deployer.address);
        expect(await this.walletDeployer.gem()).to.eq(this.token.address);
        
        // Set Authorizer in Safe Deployer
        await this.walletDeployer.rule(this.authorizer.address);
        expect(await this.walletDeployer.mom()).to.eq(this.authorizer.address);

        await expect(this.walletDeployer.can(guardian.address, DEPOSIT_ADDRESS)).not.to.be.reverted;
        await expect(this.walletDeployer.can(player.address, DEPOSIT_ADDRESS)).to.be.reverted;

        // Fund Safe Deployer with tokens
        this.initialWalletDeployerTokenBalance = (await this.walletDeployer.pay()).mul(43);
        await this.token.transfer(
            this.walletDeployer.address,
            this.initialWalletDeployerTokenBalance
        );

        // Ensure these accounts start empty
        expect(await ethers.provider.getCode(DEPOSIT_ADDRESS)).to.eq('0x');
        expect(await ethers.provider.getCode(await this.walletDeployer.fact())).to.eq('0x');
        expect(await ethers.provider.getCode(await this.walletDeployer.copy())).to.eq('0x');

        // Deposit large amount of DVT tokens to the deposit address
        await this.token.transfer(DEPOSIT_ADDRESS, DEPOSIT_TOKEN_AMOUNT);

        // Ensure initial balances are set correctly
        expect(await this.token.balanceOf(DEPOSIT_ADDRESS)).eq(DEPOSIT_TOKEN_AMOUNT);
        expect(await this.token.balanceOf(this.walletDeployer.address)).eq(
            this.initialWalletDeployerTokenBalance
        );
        expect(await this.token.balanceOf(player.address)).eq(0);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Factory account must have code
        expect(
            await ethers.provider.getCode(await this.walletDeployer.fact())
        ).to.not.eq('0x');

        // Master copy account must have code
        expect(
            await ethers.provider.getCode(await this.walletDeployer.copy())
        ).to.not.eq('0x');

        // Deposit account must have code
        expect(
            await ethers.provider.getCode(DEPOSIT_ADDRESS)
        ).to.not.eq('0x');
        
        // The deposit address and the Safe Deployer contract must not hold tokens
        expect(
            await this.token.balanceOf(DEPOSIT_ADDRESS)
        ).to.eq(0);
        expect(
            await this.token.balanceOf(this.walletDeployer.address)
        ).to.eq(0);

        // Player must own all tokens
        expect(
            await this.token.balanceOf(player.address)
        ).to.eq(this.initialWalletDeployerTokenBalance.add(DEPOSIT_TOKEN_AMOUNT)); 
    });
});
