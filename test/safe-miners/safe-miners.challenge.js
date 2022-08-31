const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Safe Miners', function () {
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
            await ethers.getContractFactory('AuthorizerUpgradeable', deployer),
            [ [ guardian.address ], [ DEPOSIT_ADDRESS ] ],
            { kind: 'uups' }
        );
        
        expect(await this.authorizer.owner()).to.eq(deployer.address);
        expect(await this.authorizer.isAuthorized(guardian.address, DEPOSIT_ADDRESS)).to.be.true;
        expect(await this.authorizer.isAuthorized(player.address, DEPOSIT_ADDRESS)).to.be.false;

        // Deploy Safe Deployer contract
        this.safeDeployer = await (await ethers.getContractFactory('SafeDeployer', deployer)).deploy(
            this.token.address
        );
        expect(await this.safeDeployer.owner()).to.eq(deployer.address);
        expect(await this.safeDeployer.token()).to.eq(this.token.address);
        
        // Set Authorizer in Safe Deployer
        await this.safeDeployer.setAuthorizer(this.authorizer.address);
        expect(await this.safeDeployer.authorizer()).to.eq(this.authorizer.address);
        expect(await this.safeDeployer.isAuthorizerSet()).to.be.true;

        // Fund Safe Deployer with tokens
        this.initialSafeDeployerTokenBalance = (await this.safeDeployer.PAYMENT_AMOUNT()).mul(10);
        await this.token.transfer(
            this.safeDeployer.address,
            this.initialSafeDeployerTokenBalance
        );

        // Ensure Deposit address is empty
        expect(await ethers.provider.getCode(DEPOSIT_ADDRESS)).to.eq('0x');

        // Deposit large amount of DVT tokens to the deposit address
        await this.token.transfer(DEPOSIT_ADDRESS, DEPOSIT_TOKEN_AMOUNT);

        // Ensure initial balances are set correctly
        expect(await this.token.balanceOf(DEPOSIT_ADDRESS)).eq(DEPOSIT_TOKEN_AMOUNT);
        expect(await this.token.balanceOf(this.safeDeployer.address)).eq(
            this.initialSafeDeployerTokenBalance
        );
        expect(await this.token.balanceOf(player.address)).eq('0');
    });

    it('Execution', async function () {
        /** YOUR CODE GOES HERE */
    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        expect(
            await ethers.provider.getCode(await this.safeDeployer.FACTORY())
        ).to.not.eq('0x');
        expect(
            await ethers.provider.getCode(await this.safeDeployer.MASTER_COPY())
        ).to.not.eq('0x');
        expect(
            await ethers.provider.getCode(DEPOSIT_ADDRESS)
        ).to.not.eq('0x');
        
        // The deposit address and the Safe Deployer contract must not hold tokens
        expect(
            await this.token.balanceOf(DEPOSIT_ADDRESS)
        ).to.eq('0');
        expect(
            await this.token.balanceOf(this.safeDeployer.address)
        ).to.eq('0');

        // Player must hold all tokens
        expect(
            await this.token.balanceOf(player.address)
        ).to.eq(DEPOSIT_TOKEN_AMOUNT.add(this.initialSafeDeployerTokenBalance)); 
    });
});
