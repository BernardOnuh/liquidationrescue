// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title What the protection vault needs from a lending protocol
/// @notice One adapter per protocol; the vault only talks to allowlisted adapters through this interface.
interface ILendingAdapter {
    /// @notice The token debt is repaid in.
    function debtAsset() external view returns (address);

    /// @notice Health factor scaled by 1e18 (below 1e18 means liquidatable); type(uint256).max with no debt.
    function healthFactor(address user) external view returns (uint256);

    /// @notice Outstanding debt in debt-asset units.
    function debtOf(address user) external view returns (uint256);

    /// @notice Collateral value counted toward borrowing, in 1e18 USD.
    function adjustedCollateralUsd(address user) external view returns (uint256);

    /// @notice Multiplier from debt-asset units to 1e18 USD.
    function debtToUsd18() external view returns (uint256);

    /// @notice When the collateral price was last updated, to reject stale data.
    function priceUpdatedAt() external view returns (uint256);

    /// @notice Repays up to `amount` of `user`'s debt, pulling the tokens from the caller.
    /// @return repaid The amount actually repaid.
    function repayFor(address user, uint256 amount) external returns (uint256 repaid);
}
