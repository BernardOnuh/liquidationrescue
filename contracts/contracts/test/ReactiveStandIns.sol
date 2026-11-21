// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

// Test-only stand-ins for Reactive Network infrastructure, behaving as its docs describe. Never deployed.
import {ISystemContract} from "../lib/reactive-lib-omni/interfaces/ISystemContract.sol";

/// @notice Placed at 0x8888…8888 in tests (the address AbstractReactive hardcodes). Records subscriptions and
/// callback requests instead of delivering them; the tests deliver them through MockCallbackProxy.
contract MockSystemContract {
    struct Sub { uint256 chainId; address contract_; uint256 topic0; uint256 topic1; uint256 topic2; uint256 topic3; }
    Sub[] public subscriptions;

    event Subscribed(uint256 chainId, address contract_, uint256 topic0, uint256 topic1);
    event CallbackRequest(uint256 indexed chainId, address indexed sender, address indexed recipient, uint64 gasLimit, bytes payload);

    function subscribe(uint256 chainId_, address contract_, uint256 t0, uint256 t1, uint256 t2, uint256 t3) external {
        subscriptions.push(Sub(chainId_, contract_, t0, t1, t2, t3));
        emit Subscribed(chainId_, contract_, t0, t1);
    }

    function unsubscribe(uint256, address, uint256, uint256, uint256, uint256) external {}

    function requestCallbackV_1_0(ISystemContract.CallbackConfiguration_V_1_0 memory c) external {
        emit CallbackRequest(c.chainId, msg.sender, c.recipient, c.gasLimit, c.payload);
    }

    function subscriptionCount() external view returns (uint256) { return subscriptions.length; }
    function debt(address) external pure returns (uint256) { return 0; }
    receive() external payable {}
}

/// @notice Delivers a callback the way Reactive Network's callback proxy does: the first 160 bits of the first
/// argument are replaced with the address of the reactive contract that requested it, then the target is called.
contract MockCallbackProxy {
    event Delivered(address indexed target, bool success, bytes result);

    function deliver(address reactiveSender, address target, bytes memory payload) external returns (bool success, bytes memory result) {
        require(payload.length >= 36, "payload too short");
        assembly {
            // payload data starts at payload+32; the selector is 4 bytes, then the first 32-byte argument.
            mstore(add(payload, 36), reactiveSender)
        }
        (success, result) = target.call(payload);
        emit Delivered(target, success, result);
        if (!success) {
            assembly { revert(add(result, 32), mload(result)) }
        }
    }

    function debt(address) external pure returns (uint256) { return 0; }
    receive() external payable {}
}
