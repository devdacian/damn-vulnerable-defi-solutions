// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TrustfulOracle.sol";
import "../DamnValuableNFT.sol";

/**
 * @title Exchange
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract Exchange is ReentrancyGuard {
    using Address for address payable;

    DamnValuableNFT public immutable token;
    TrustfulOracle public immutable oracle;

    error InvalidPayment();
    error SellerNotOwner(uint256 id);
    error TransferNotApproved();
    error NotEnoughFunds();

    event TokenBought(address indexed buyer, uint256 tokenId, uint256 price);
    event TokenSold(address indexed seller, uint256 tokenId, uint256 price);

    constructor(address _oracle) payable {
        token = new DamnValuableNFT();
        oracle = TrustfulOracle(_oracle);
    }

    function buyOne() external payable nonReentrant returns (uint256) {
        uint256 payment = msg.value;
        if (payment == 0)
            revert InvalidPayment();

        // Price should be in [wei / NFT]
        uint256 price = oracle.getMedianPrice(token.symbol());
        if (payment < price)
            revert InvalidPayment();

        uint256 id = token.safeMint(msg.sender);
        unchecked {
            payable(msg.sender).sendValue(payment - price);
        }

        emit TokenBought(msg.sender, id, price);

        return id;
    }

    function sellOne(uint256 id) external nonReentrant {
        if(msg.sender != token.ownerOf(id))
            revert SellerNotOwner(id);
    
        if(token.getApproved(id) != address(this))
            revert TransferNotApproved();

        // Price should be in [wei / NFT]
        uint256 price = oracle.getMedianPrice(token.symbol());
        if(address(this).balance < price)
            revert NotEnoughFunds();

        token.transferFrom(msg.sender, address(this), id);
        token.burn(id);

        payable(msg.sender).sendValue(price);

        emit TokenSold(msg.sender, id, price);
    }

    receive() external payable {}
}
