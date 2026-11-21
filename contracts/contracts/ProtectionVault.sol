// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AbstractCallback} from "./lib/reactive-lib-omni/base/AbstractCallback.sol";
import {IPayable} from "./lib/reactive-lib-omni/interfaces/IPayable.sol";
import {ILendingAdapter} from "./ILendingAdapter.sol";

/// @title LiquidationRescue protection vault (destination-chain callback contract)
/// @notice Each user keeps their own rescue reserve here and sets a policy: below `triggerHF`, repay debt up to
/// `maxSpend` to bring the health factor back to `targetHF`, until `expiry`. Rescues are only started by the
/// authorized reactive contract through Reactive Network's callback proxy, and the vault re-reads the live position
/// before spending anything. Every decision, including refusals, is recorded per event.
/// @dev Not audited. Testnet only. A rescue is best-effort: it can't help a position that is already liquidated,
/// and it can't act faster than the risk event arrives.
contract ProtectionVault is AbstractCallback, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Policy {
        uint256 triggerHF; // rescue when the health factor is below this (1e18 = 1.0)
        uint256 targetHF; // repay enough to reach this
        uint256 maxSpend; // lifetime spend cap, in debt-asset units
        uint256 spent; // spent so far
        uint64 expiry; // no rescues after this timestamp
        bool paused;
        bool active;
    }

    enum Outcome {
        None,
        Rescued, // repaid; the health factor reached the target
        PartiallyRescued, // repaid what the budget allowed; still below target
        NotNeeded, // healthy at the time of the callback
        PolicyInactive, // no policy, or it was revoked
        PolicyPaused,
        PolicyExpired,
        BudgetExhausted, // max spend already used
        NoReserve, // nothing deposited
        StalePrice, // the price was too old to trust
        AlreadyLiquidated, // no debt left: nothing to protect
        RepayFailed // the lending protocol rejected the repayment
    }

    struct RescueRecord {
        address user;
        Outcome outcome;
        uint256 observedPrice; // price carried by the risk event (8 decimals)
        uint256 hfBefore;
        uint256 hfAfter;
        uint256 spent;
        uint64 at;
    }

    ILendingAdapter public immutable adapter;
    IERC20 public immutable debtAsset;
    /// @notice Prices older than this are rejected.
    uint256 public immutable maxPriceAge;
    uint256 public constant MIN_TRIGGER_HF = 1e18; // a trigger at or below 1.0 would wait for liquidation
    uint256 public constant MAX_TARGET_HF = 5e18;

    mapping(address user => Policy) private _policies;
    mapping(address user => uint256) public reserveOf;
    mapping(bytes32 eventId => RescueRecord) private _records;

    event PolicyConfigured(address indexed user, uint256 triggerHF, uint256 targetHF, uint256 maxSpend, uint64 expiry);
    event PolicyPausedSet(address indexed user, bool paused);
    event PolicyRevoked(address indexed user);
    event ReserveFunded(address indexed user, uint256 amount);
    event ReserveWithdrawn(address indexed user, uint256 amount);
    event RescueEvaluated(bytes32 indexed eventId, address indexed user, Outcome outcome, uint256 hfBefore, uint256 hfAfter, uint256 spent);
    event DuplicateEventIgnored(bytes32 indexed eventId, address indexed user);

    error InvalidPolicy(string reason);
    error InsufficientReserve(uint256 requested, uint256 available);

    /// @param callbackProxy_ Reactive Network's callback proxy on this chain.
    /// @param reactive_ The LiquidationRescueReactive contract on Reactive Network allowed to start rescues.
    constructor(IPayable callbackProxy_, address reactive_, ILendingAdapter adapter_, uint256 maxPriceAge_)
        payable
        AbstractCallback(callbackProxy_, reactive_)
    {
        adapter = adapter_;
        debtAsset = IERC20(adapter_.debtAsset());
        maxPriceAge = maxPriceAge_;
    }

    // ---------- the user's own controls ----------

    function configurePolicy(uint256 triggerHF, uint256 targetHF, uint256 maxSpend, uint64 expiry) external {
        if (triggerHF <= MIN_TRIGGER_HF) revert InvalidPolicy("trigger must be above 1.0");
        if (targetHF <= triggerHF) revert InvalidPolicy("target must be above trigger");
        if (targetHF > MAX_TARGET_HF) revert InvalidPolicy("target too high");
        if (maxSpend == 0) revert InvalidPolicy("max spend is zero");
        if (expiry <= block.timestamp) revert InvalidPolicy("expiry is in the past");
        Policy storage p = _policies[msg.sender];
        // Reconfiguring keeps what was already spent, so a new policy can't reset the lifetime cap.
        uint256 spent = p.active ? p.spent : 0;
        _policies[msg.sender] = Policy(triggerHF, targetHF, maxSpend, spent, expiry, false, true);
        emit PolicyConfigured(msg.sender, triggerHF, targetHF, maxSpend, expiry);
    }

    function setPaused(bool paused) external {
        if (!_policies[msg.sender].active) revert InvalidPolicy("no policy");
        _policies[msg.sender].paused = paused;
        emit PolicyPausedSet(msg.sender, paused);
    }

    function revokePolicy() external {
        delete _policies[msg.sender];
        emit PolicyRevoked(msg.sender);
    }

    function fundReserve(uint256 amount) external nonReentrant {
        debtAsset.safeTransferFrom(msg.sender, address(this), amount);
        reserveOf[msg.sender] += amount;
        emit ReserveFunded(msg.sender, amount);
    }

    /// @notice The owner can always take back what wasn't spent.
    function withdrawUnused(uint256 amount) external nonReentrant {
        uint256 available = reserveOf[msg.sender];
        if (amount > available) revert InsufficientReserve(amount, available);
        reserveOf[msg.sender] = available - amount;
        debtAsset.safeTransfer(msg.sender, amount);
        emit ReserveWithdrawn(msg.sender, amount);
    }

    // ---------- the rescue ----------

    /// @notice Called by Reactive Network through the callback proxy when a risk event concerns `user`.
    /// @param reactive_ Injected by the network: the reactive contract that requested this callback.
    /// @param eventId Unique per origin event and user, so one event can never spend twice.
    function onRiskEvent(address reactive_, bytes32 eventId, address user, uint256 observedPrice)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
        nonReentrant
    {
        if (_records[eventId].outcome != Outcome.None) {
            emit DuplicateEventIgnored(eventId, user);
            return;
        }
        RescueRecord storage r = _records[eventId];
        r.user = user;
        r.observedPrice = observedPrice;
        r.at = uint64(block.timestamp);
        r.hfBefore = adapter.healthFactor(user);
        r.hfAfter = r.hfBefore;
        r.outcome = _rescue(user, r);
        emit RescueEvaluated(eventId, user, r.outcome, r.hfBefore, r.hfAfter, r.spent);
    }

    function _rescue(address user, RescueRecord storage r) private returns (Outcome) {
        Policy storage p = _policies[user];
        if (!p.active) return Outcome.PolicyInactive;
        if (p.paused) return Outcome.PolicyPaused;
        if (block.timestamp > p.expiry) return Outcome.PolicyExpired;
        if (block.timestamp - adapter.priceUpdatedAt() > maxPriceAge) return Outcome.StalePrice;
        uint256 debt = adapter.debtOf(user);
        if (debt == 0) return Outcome.AlreadyLiquidated;
        if (r.hfBefore >= p.triggerHF) return Outcome.NotNeeded;
        if (p.spent >= p.maxSpend) return Outcome.BudgetExhausted;
        if (reserveOf[user] == 0) return Outcome.NoReserve;

        uint256 amount = _repayToReach(user, debt, p.targetHF);
        uint256 budget = p.maxSpend - p.spent;
        if (amount > budget) amount = budget;
        if (amount > reserveOf[user]) amount = reserveOf[user];

        // Effects first: the reserve and spend are booked before the external call.
        reserveOf[user] -= amount;
        debtAsset.forceApprove(address(adapter), amount);
        try adapter.repayFor(user, amount) returns (uint256 repaid) {
            debtAsset.forceApprove(address(adapter), 0);
            reserveOf[user] += amount - repaid; // anything not needed goes back to the reserve
            p.spent += repaid;
            r.spent = repaid;
            r.hfAfter = adapter.healthFactor(user);
            return r.hfAfter >= p.targetHF ? Outcome.Rescued : Outcome.PartiallyRescued;
        } catch {
            debtAsset.forceApprove(address(adapter), 0);
            reserveOf[user] += amount;
            return Outcome.RepayFailed;
        }
    }

    /// @notice Debt to repay so that health factor = targetHF: adjustedCollateral / (debt − x) = target.
    function _repayToReach(address user, uint256 debt, uint256 targetHF) private view returns (uint256) {
        uint256 allowedDebtUsd = adapter.adjustedCollateralUsd(user) * 1e18 / targetHF;
        uint256 allowedDebt = allowedDebtUsd / adapter.debtToUsd18(); // rounded down, so the repayment rounds up
        return debt > allowedDebt ? debt - allowedDebt : 0;
    }

    // ---------- reading ----------

    function getPolicy(address user) external view returns (Policy memory) {
        return _policies[user];
    }

    function getRescueRecord(bytes32 eventId) external view returns (RescueRecord memory) {
        return _records[eventId];
    }

    /// @notice Lets anyone settle this contract's callback fees from its own balance.
    function coverDebt() external {
        _coverDebt();
    }
}
