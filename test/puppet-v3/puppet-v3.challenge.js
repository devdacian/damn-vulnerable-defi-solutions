const { ethers } = require('hardhat');
const { expect } = require('chai');
const { time, setBalance } = require("@nomicfoundation/hardhat-network-helpers");

const positionManagerJson = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
const factoryJson = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");

// See https://github.com/Uniswap/v3-periphery/blob/5bcdd9f67f9394f3159dad80d0dd01d37ca08c66/test/shared/encodePriceSqrt.ts
const bn = require("bignumber.js");
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });
function encodePriceSqrt(reserve0, reserve1) {
    return ethers.BigNumber.from(
        new bn(reserve1.toString())
            .div(reserve0.toString())
            .sqrt()
            .multipliedBy(new bn(2).pow(96))
            .integerValue(3)
            .toString()
    )
}

describe('[Challenge] Puppet v3', function () {
    let deployer, player;

    /** SET NODE URL HERE */
    const MAINNET_FORKING_URL = "";

    // Uniswap v3 exchange starts with 100 tokens and 100 WETH in liquidity
    const UNISWAP_INITIAL_TOKEN_LIQUIDITY = 100n * 10n ** 18n;
    const UNISWAP_INITIAL_WETH_LIQUIDITY = 100n * 10n ** 18n;

    const PLAYER_INITIAL_TOKEN_BALANCE = 110n * 10n ** 18n;
    const PLAYER_INITIAL_ETH_BALANCE = 1n * 10n ** 18n;
    const DEPLOYER_INITIAL_ETH_BALANCE = 200n * 10n ** 18n;

    const LENDING_POOL_INITIAL_TOKEN_BALANCE = 1000000n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */

        // Fork from mainnet state
        await ethers.provider.send("hardhat_reset", [{
            forking: { jsonRpcUrl: MAINNET_FORKING_URL, blockNumber: 15450164 }
        }]);

        // Initialize player account with 10 ETH in balance
        // using private key of account #2 in Hardhat's node
        player = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", ethers.provider);
        await setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
        expect(await ethers.provider.getBalance(player.address)).to.eq(PLAYER_INITIAL_ETH_BALANCE);

        // Initialize deployer account with 200 ETH in balance
        // using private key of account #1 in Hardhat's node
        deployer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", ethers.provider);
        await setBalance(deployer.address, DEPLOYER_INITIAL_ETH_BALANCE);
        expect(await ethers.provider.getBalance(deployer.address)).to.eq(DEPLOYER_INITIAL_ETH_BALANCE);

        // Get a reference to the Uniswap V3 Factory contract
        this.uniswapFactory = new ethers.Contract("0x1F98431c8aD98523631AE4a59f267346ea31F984", factoryJson.abi, deployer);

        // Get a reference to WETH9
        this.weth = (await ethers.getContractFactory('WETH9', deployer)).attach("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");

        // Deployer wraps ETH in WETH
        await this.weth.deposit({ value: UNISWAP_INITIAL_WETH_LIQUIDITY });
        expect(await this.weth.balanceOf(deployer.address)).to.eq(UNISWAP_INITIAL_WETH_LIQUIDITY);

        // Deploy DVT token. This is the token to be traded against WETH in the Uniswap v3 exchange.
        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        
        // Create the Uniswap v3 exchange
        this.uniswapPositionManager = new ethers.Contract("0xC36442b4a4522E871399CD717aBDD847Ab11FE88", positionManagerJson.abi, deployer);
        const FEE = 3000; // 0.3%
        await this.uniswapPositionManager.createAndInitializePoolIfNecessary(
            this.weth.address,  // token0
            this.token.address, // token1
            FEE,
            encodePriceSqrt(1, 1),
            { gasLimit: 5000000 }
        );
        
        // Deployer adds liquidity at current price to Uniswap V3 exchange
        await this.weth.approve(this.uniswapPositionManager.address, ethers.constants.MaxUint256);
        await this.token.approve(this.uniswapPositionManager.address, ethers.constants.MaxUint256);
        await this.uniswapPositionManager.mint({
            token0: this.weth.address,
            token1: this.token.address,
            tickLower: -60,
            tickUpper: 60,
            fee: FEE,
            recipient: deployer.address,
            amount0Desired: UNISWAP_INITIAL_WETH_LIQUIDITY,
            amount1Desired: UNISWAP_INITIAL_TOKEN_LIQUIDITY,
            amount0Min: 0,
            amount1Min: 0,
            deadline: (await ethers.provider.getBlock('latest')).timestamp * 2,
        }, { gasLimit: 5000000 });

        // Deploy the lending pool
        this.lendingPool = await (await ethers.getContractFactory('PuppetV3Pool', deployer)).deploy(
            this.weth.address,
            this.token.address,
            await this.uniswapFactory.getPool(
                this.weth.address,
                this.token.address,
                FEE
            )
        );

        // 60 minutes pass
        await time.increase(60 * 60);

        // Setup initial token balances of lending pool and player
        await this.token.transfer(player.address, PLAYER_INITIAL_TOKEN_BALANCE);
        await this.token.transfer(this.lendingPool.address, LENDING_POOL_INITIAL_TOKEN_BALANCE);

        // Ensure oracle in lending pool is working as expected. At this point, DVT/WETH price should be 1:1.
        // To borrow 1 DVT, must deposit 3 ETH
        expect(
            await this.lendingPool.calculateDepositOfWETHRequired(1n * 10n ** 18n)
        ).to.be.eq(3n * 10n ** 18n);

        // To borrow all DVT in lending pool, user must deposit three times its value
        expect(
            await this.lendingPool.calculateDepositOfWETHRequired(LENDING_POOL_INITIAL_TOKEN_BALANCE)
        ).to.be.eq(LENDING_POOL_INITIAL_TOKEN_BALANCE * 3n);

        // Ensure player doesn't have that much ETH
        expect(await ethers.provider.getBalance(player.address)).to.be.lt(LENDING_POOL_INITIAL_TOKEN_BALANCE * 3n);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

        // Player has taken all tokens from the pool        
        expect(
            await this.token.balanceOf(this.lendingPool.address)
        ).to.be.eq('0');

        expect(
            await this.token.balanceOf(player.address)
        ).to.be.gte(LENDING_POOL_INITIAL_TOKEN_BALANCE);
    });
});