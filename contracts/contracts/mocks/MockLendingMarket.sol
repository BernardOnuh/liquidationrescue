// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MockPriceOracle} from "./MockPriceOracle.sol";

/// @title Minimal lending market for the demo
/// @notice One collateral asset, one debt asset priced at $1. Health factor = collateral value × liquidation
/// threshold ÷ debt, scaled by 1e18; below 1e18 the position can be liquidated. This is a mock, disclosed as such:
/// no interest, no partial liquidation, no reserves.
contract MockLendingMarket {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralAsset;
    IERC20 public immutable debtAsset;
    MockPriceOracle public immutable oracle;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8000; // 80%
    uint256 private immutable _collateralScale; // 10 ** collateral decimals
    uint256 private immutable _debtToUsd18; // multiplier from debt units to 1e18 USD

    struct Position {
        uint256 collateral;
        uint256 debt;
    }

    mapping(address user => Position) public positions;

    event CollateralDeposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, address indexed payer, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 debtRepaid, uint256 collateralSeized);

    constructor(IERC20 collateral_, IERC20 debt_, MockPriceOracle oracle_) {
        collateralAsset = collateral_;
        debtAsset = debt_;
        oracle = oracle_;
        _collateralScale = 10 ** IERC20Metadata(address(collateral_)).decimals();
        _debtToUsd18 = 10 ** (18 - IERC20Metadata(address(debt_)).decimals());
    }

    function depositCollateral(uint256 amount) external {
        collateralAsset.safeTransferFrom(msg.sender, address(this), amount);
        positions[msg.sender].collateral += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

    function borrow(uint256 amount) external {
        positions[msg.sender].debt += amount;
        require(healthFactor(msg.sender) >= 1e18, "would be undercollateralised");
        debtAsset.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    /// @notice Repays `amount` of `user`'s debt with the caller's tokens (capped at the outstanding debt).
    /// @return repaid The amount actually taken from the caller.
    function repay(address user, uint256 amount) external returns (uint256 repaid) {
        Position storage p = positions[user];
        repaid = amount > p.debt ? p.debt : amount;
        p.debt -= repaid;
        debtAsset.safeTransferFrom(msg.sender, address(this), repaid);
        emit Repaid(user, msg.sender, repaid);
    }

    /// @notice Anyone may liquidate a position whose health factor is below 1: they repay all its debt and take all
    /// its collateral. Deliberately harsh, so the cost of not being rescued is obvious in the demo.
    function liquidate(address user) external {
        require(healthFactor(user) < 1e18, "position is healthy");
        Position memory p = positions[user];
        delete positions[user];
        debtAsset.safeTransferFrom(msg.sender, address(this), p.debt);
        collateralAsset.safeTransfer(msg.sender, p.collateral);
        emit Liquidated(user, msg.sender, p.debt, p.collateral);
    }

    /// @notice Collateral value counted toward borrowing (after the liquidation threshold), in 1e18 USD.
    function adjustedCollateralUsd(address user) public view returns (uint256) {
        (uint256 price,) = oracle.latest(address(collateralAsset));
        return positions[user].collateral * price * 1e10 / _collateralScale * LIQUIDATION_THRESHOLD_BPS / 10_000;
    }

    function debtUsd(address user) public view returns (uint256) {
        return positions[user].debt * _debtToUsd18;
    }

    /// @return Health factor scaled by 1e18; type(uint256).max when there is no debt.
    function healthFactor(address user) public view returns (uint256) {
        uint256 d = debtUsd(user);
        if (d == 0) return type(uint256).max;
        return adjustedCollateralUsd(user) * 1e18 / d;
    }
}
