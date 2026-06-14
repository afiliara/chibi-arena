// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Minimal mintable ERC-20 used for local and testnet arena settlement.
contract MockERC20 is ERC20 {
    /// @notice Deploys the mock token contract.
    /// @param name_ ERC-20 token name.
    /// @param symbol_ ERC-20 token symbol.
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /// @notice Mints tokens for testing and local development.
    /// @param to Recipient of the minted tokens.
    /// @param amount Amount to mint.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
