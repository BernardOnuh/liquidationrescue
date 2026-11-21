// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ILendingAdapter} from "./ILendingAdapter.sol";
import {MockLendingMarket} from "./mocks/MockLendingMarket.sol";

/// @title Adapter for the demo lending market
contract MockMarketAdapter is ILendingAdapter {
    using SafeERC20 for IERC20;

    MockLendingMarket public immutable market;

    constructor(MockLendingMarket market_) {
        market = market_;
    }

    function debtAsset() external view returns (address) {
        return address(market.debtAsset());
    }

    function healthFactor(address user) external view returns (uint256) {
        return market.healthFactor(user);
    }

    function debtOf(address user) external view returns (uint256) {
        (, uint256 debt) = market.positions(user);
        return debt;
    }

    function adjustedCollateralUsd(address user) external view returns (uint256) {
        return market.adjustedCollateralUsd(user);
    }

    function debtToUsd18() external view returns (uint256) {
        return 10 ** (18 - IERC20Metadata(address(market.debtAsset())).decimals());
    }

    function priceUpdatedAt() external view returns (uint256) {
        (, uint256 updatedAt) = market.oracle().latest(address(market.collateralAsset()));
        return updatedAt;
    }

    function repayFor(address user, uint256 amount) external returns (uint256 repaid) {
        IERC20 debt = market.debtAsset();
        debt.safeTransferFrom(msg.sender, address(this), amount);
        debt.forceApprove(address(market), amount);
        repaid = market.repay(user, amount);
        if (repaid < amount) debt.safeTransfer(msg.sender, amount - repaid); // return what wasn't needed
        debt.forceApprove(address(market), 0);
    }
}
