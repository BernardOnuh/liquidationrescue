// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractReactive} from "./lib/reactive-lib-omni/base/AbstractReactive.sol";
import {IReactive} from "./lib/reactive-lib-omni/interfaces/IReactive.sol";
import {ISystemContract} from "./lib/reactive-lib-omni/interfaces/ISystemContract.sol";

/// @title LiquidationRescue reactive contract (Reactive Network)
/// @notice Event-driven, not polled: it subscribes to the price feed's `PriceUpdated` events on the origin chain and,
/// when the collateral price drops, asks Reactive Network to call the protection vault for every user with an active
/// policy. It learns who is protected from the vault's own `PolicyConfigured` / `PolicyRevoked` events. It never
/// decides how much to spend: the vault re-reads the live position and its policy before acting.
contract LiquidationRescueReactive is AbstractReactive {
    // keccak256("PriceUpdated(address,uint256,uint256)")
    uint256 public constant PRICE_UPDATED_TOPIC = uint256(keccak256("PriceUpdated(address,uint256,uint256)"));
    // keccak256("PolicyConfigured(address,uint256,uint256,uint256,uint64)")
    uint256 public constant POLICY_CONFIGURED_TOPIC = uint256(keccak256("PolicyConfigured(address,uint256,uint256,uint256,uint64)"));
    // keccak256("PolicyRevoked(address)")
    uint256 public constant POLICY_REVOKED_TOPIC = uint256(keccak256("PolicyRevoked(address)"));
    uint64 public constant CALLBACK_GAS_LIMIT = 900_000;
    uint256 public constant MAX_USERS = 50; // bounds the callbacks one price event can trigger

    address public immutable owner;
    uint256 public immutable originChainId; // where the price feed and the vault live (e.g. Base Sepolia, 84532)
    address public immutable oracle;
    address public immutable collateralAsset;
    address public vault; // set once, after the vault is deployed with this contract's address

    uint256 public lastPrice;
    address[] private _users;
    mapping(address user => uint256 indexPlusOne) private _userIndex;

    event VaultSet(address indexed vault);
    event UserProtected(address indexed user);
    event UserUnprotected(address indexed user);
    /// @param originTxHash The origin-chain transaction that carried the price drop, so each rescue can be traced across chains.
    event RescueRequested(bytes32 indexed eventId, address indexed user, uint256 price, uint256 previousPrice, uint256 originTxHash);
    event PriceIgnored(uint256 price, uint256 previousPrice);

    error NotOwner();
    error VaultAlreadySet();

    /// @dev Payable so it can be funded with REACT at deployment to pay for reactive transactions.
    constructor(address owner_, uint256 originChainId_, address oracle_, address collateralAsset_) payable {
        owner = owner_;
        originChainId = originChainId_;
        oracle = oracle_;
        collateralAsset = collateralAsset_;
        // Only this asset's price updates from this feed.
        SYSTEM.subscribe(originChainId_, oracle_, PRICE_UPDATED_TOPIC, uint256(uint160(collateralAsset_)), REACTIVE_IGNORE, REACTIVE_IGNORE);
    }

    /// @notice Links the vault (deployed second, with this contract as its authorized callback sender) and subscribes to
    /// its policy events. Can be called once.
    function setVault(address vault_) external {
        if (msg.sender != owner) revert NotOwner();
        if (vault != address(0)) revert VaultAlreadySet();
        vault = vault_;
        SYSTEM.subscribe(originChainId, vault_, POLICY_CONFIGURED_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
        SYSTEM.subscribe(originChainId, vault_, POLICY_REVOKED_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
        emit VaultSet(vault_);
    }

    /// @inheritdoc IReactive
    function react(LogRecord memory log_) external onlySystem {
        if (log_.chainId != originChainId) return;

        if (log_.contractAddress == oracle && log_.topic0 == PRICE_UPDATED_TOPIC && log_.topic1 == uint256(uint160(collateralAsset))) {
            (uint256 price,) = abi.decode(log_.data, (uint256, uint256));
            uint256 previous = lastPrice;
            lastPrice = price;
            // Only a drop can push a position toward liquidation. The first price seen just sets the baseline.
            if (previous == 0 || price >= previous || vault == address(0)) {
                emit PriceIgnored(price, previous);
                return;
            }
            for (uint256 i = 0; i < _users.length; i++) {
                address user = _users[i];
                // Unique per origin log and user: the vault refuses to process the same id twice.
                bytes32 eventId = keccak256(abi.encode(log_.chainId, log_.txHash, log_.logIndex, user));
                _requestRescue(eventId, user, price);
                emit RescueRequested(eventId, user, price, previous, log_.txHash);
            }
            return;
        }

        if (log_.contractAddress == vault && log_.topic0 == POLICY_CONFIGURED_TOPIC) {
            address user = address(uint160(log_.topic1));
            if (_userIndex[user] == 0 && _users.length < MAX_USERS) {
                _users.push(user);
                _userIndex[user] = _users.length;
                emit UserProtected(user);
            }
            return;
        }

        if (log_.contractAddress == vault && log_.topic0 == POLICY_REVOKED_TOPIC) {
            _removeUser(address(uint160(log_.topic1)));
        }
    }

    function _requestRescue(bytes32 eventId, address user, uint256 price) private {
        // The first argument is a placeholder: the network replaces it with this contract's address so the vault
        // can authenticate the callback.
        bytes memory payload = abi.encodeWithSignature("onRiskEvent(address,bytes32,address,uint256)", address(0), eventId, user, price);
        SYSTEM.requestCallbackV_1_0(ISystemContract.CallbackConfiguration_V_1_0({
            chainId: originChainId,
            recipient: vault,
            gasLimit: CALLBACK_GAS_LIMIT,
            payload: payload
        }));
    }

    function _removeUser(address user) private {
        uint256 idx = _userIndex[user];
        if (idx == 0) return;
        address last = _users[_users.length - 1];
        _users[idx - 1] = last;
        _userIndex[last] = idx;
        _users.pop();
        delete _userIndex[user];
        emit UserUnprotected(user);
    }

    function protectedUsers() external view returns (address[] memory) {
        return _users;
    }

    /// @notice Lets anyone settle this contract's debt to the system contract from its own balance.
    function coverDebt() external {
        _coverDebt();
    }
}
