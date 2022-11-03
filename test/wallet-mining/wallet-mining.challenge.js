const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Wallet mining', function () {
    let deployer, player;
    
    const DEPOSIT_ADDRESS = '0x9b6fb606a9f5789444c17768c6dfcf2f83563801';
    const DEPOSIT_TOKEN_AMOUNT = ethers.utils.parseEther('20000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [ deployer, guardian, player ] = await ethers.getSigners();

        // Deploy Damn Valuable Token contract
        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();

        // Deploy authorizer with the corresponding proxy
        this.authorizer = await upgrades.deployProxy(
            await ethers.getContractFactory('Authorizer', deployer),
            [ [ guardian.address ], [ DEPOSIT_ADDRESS ] ], // initialization data
            { kind: 'uups' }
        );
        
        expect(await this.authorizer.owner()).to.eq(deployer.address);
        expect(await this.authorizer.isAuthorized(guardian.address, DEPOSIT_ADDRESS)).to.be.true;
        expect(await this.authorizer.isAuthorized(player.address, DEPOSIT_ADDRESS)).to.be.false;

        // Deploy WalletDeployer contract
        this.walletDeployer = await (await ethers.getContractFactory('WalletDeployer', deployer)).deploy(
            this.token.address
        );
        expect(await this.walletDeployer.owner()).to.eq(deployer.address);
        expect(await this.walletDeployer.token()).to.eq(this.token.address);
        
        // Set Authorizer in WalletDeployer
        await this.walletDeployer.setAuthorizer(this.authorizer.address);
        expect(await this.walletDeployer.authorizer()).to.eq(this.authorizer.address);

        await expect(this.walletDeployer.isAuthorized(guardian.address, DEPOSIT_ADDRESS)).not.to.be.reverted;
        await expect(this.walletDeployer.isAuthorized(player.address, DEPOSIT_ADDRESS)).to.be.reverted;

        // Fund WalletDeployer with tokens
        this.initialWalletDeployerTokenBalance = (await this.walletDeployer.PAYMENT_AMOUNT()).mul(43);
        await this.token.transfer(
            this.walletDeployer.address,
            this.initialWalletDeployerTokenBalance
        );

        // Ensure these accounts start empty
        expect(await ethers.provider.getCode(DEPOSIT_ADDRESS)).to.eq('0x');
        expect(await ethers.provider.getCode(await this.walletDeployer.FACTORY())).to.eq('0x');
        expect(await ethers.provider.getCode(await this.walletDeployer.MASTER_COPY())).to.eq('0x');

        // Deposit large amount of DVT tokens to the deposit address
        await this.token.transfer(DEPOSIT_ADDRESS, DEPOSIT_TOKEN_AMOUNT);

        // Ensure initial balances are set correctly
        expect(await this.token.balanceOf(DEPOSIT_ADDRESS)).eq(DEPOSIT_TOKEN_AMOUNT);
        expect(await this.token.balanceOf(this.walletDeployer.address)).eq(
            this.initialWalletDeployerTokenBalance
        );
        expect(await this.token.balanceOf(player.address)).eq('0');
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Factory account must have code
        expect(
            await ethers.provider.getCode(await this.walletDeployer.FACTORY())
        ).to.not.eq('0x');

        // Master copy account must have code
        expect(
            await ethers.provider.getCode(await this.walletDeployer.MASTER_COPY())
        ).to.not.eq('0x');

        // Deposit account must have code
        expect(
            await ethers.provider.getCode(DEPOSIT_ADDRESS)
        ).to.not.eq('0x');
        
        // Neither the deposit address nor the WalletDeployer contract must hold tokens
        expect(
            await this.token.balanceOf(DEPOSIT_ADDRESS)
        ).to.eq('0');
        expect(
            await this.token.balanceOf(this.walletDeployer.address)
        ).to.eq('0');

        // Player must own all tokens
        expect(
            await this.token.balanceOf(player.address)
        ).to.eq(DEPOSIT_TOKEN_AMOUNT.add(this.initialWalletDeployerTokenBalance)); 
    });
});
