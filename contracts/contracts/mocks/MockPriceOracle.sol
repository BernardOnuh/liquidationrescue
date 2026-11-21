// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Testnet price feed and risk emitter
/// @notice Prices in USD with 8 decimals. Each update emits `PriceUpdated`, the on-chain risk signal the
/// reactive contract subscribes to. On testnet the owner sets prices deterministically to reproduce scenarios.
contract MockPriceOracle is Ownable {
    struct Price {
        uint256 price;
        uint256 updatedAt;
    }

    mapping(address asset => Price) private _prices;

    event PriceUpdated(address indexed asset, uint256 price, uint256 updatedAt);

    constructor(address owner_) Ownable(owner_) {}

    function setPrice(address asset, uint256 price) external onlyOwner {
        require(price > 0, "price is zero");
        _prices[asset] = Price(price, block.timestamp);
        emit PriceUpdated(asset, price, block.timestamp);
    }

    /// @return price USD price with 8 decimals.
    /// @return updatedAt When it was last set.
    function latest(address asset) external view returns (uint256 price, uint256 updatedAt) {
        Price memory p = _prices[asset];
        return (p.price, p.updatedAt);
    }
}
