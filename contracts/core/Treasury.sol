// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.6.10;

import "@openzeppelin/contracts/math/Math.sol";
import "./interfaces/CTokenInterfaces.sol";
import "./interfaces/IDai.sol";
import "./helpers/DecimalMath.sol";
import "./helpers/Orchestrated.sol";


/**
 * @dev Treasury manages asset transfers between all contracts in the Yield Protocol and external token contracts.
 * Treasury doesn't have any transactional functions available for regular users.
 * All transactional methods are to be available only for orchestrated contracts.
 */
contract Treasury is Orchestrated(), DecimalMath {

    // TODO: Consider having a mapping of accepted token/cToken pairs, and pre-approving all transfers

    /// @dev Grab an ERC20 from the client and use it to mint cToken for the Treasury
    function pushUnderlying(address underlying, address cToken, address from, uint256 amount)
        public
        onlyOrchestrated("Treasury: Not Authorized")
    {
        ICERC20Token _cToken = ICERC20Token(cToken);
        require(_cToken.underlying() == underlying, "Treasury: Not a valid pair");
        require(IERC20(underlying).transferFrom(from, address(this), amount));  // Take underlying from user to Treasury
        _cToken.mint(amount);
    }

    /// @dev Grab a cToken from the client and keep it in the Treasury
    function pushCToken(address cToken, address from, uint256 amount)
        public
        onlyOrchestrated("Treasury: Not Authorized")
    {
        ICERC20Token _cToken = ICERC20Token(cToken);
        _cToken.transferFrom(from, address(this), amount);
        _cToken.redeemUnderlying(amount); // TODO: The parameter is in Dai or cDai? Is it the same?
    }

    /// @dev Redeem a cERC20 from the Treasury and return the underlying to the client
    function pullUnderlying(address cToken, address to, uint256 amount)
        public
        onlyOrchestrated("Treasury: Not Authorized")
    {
        // TODO: Consider a reverse search, so that the underlying is passed as a paraeter and not the cToken
        ICERC20Token _cToken = ICERC20Token(cToken);
        IERC20 underlying = IERC20(_cToken.underlying());
        _cToken.redeemUnderlying(amount); // TODO: The parameter is in Dai or cDai? Is it the same?
        require(underlying.transfer(to, amount));
    }

    /// @dev Transfer a cToken from the Treasury to the client
    function pullCToken(address cToken, address to, uint256 amount)
        public
        onlyOrchestrated("Treasury: Not Authorized")
    {
        // If there aren't enough cToken this will fail. That is fine. Try executing `balanceHoldings(cToken1, cToken2)`
        require(ICERC20Token(cToken).transfer(to, amount));
    }

    /// @dev Evaluate if some cToken1 could be converted to cToken2, and do it if appropriate
    function balanceHoldings(address cToken1, address cToken2)
        external
    {
        // Calculate surplus of cToken1
        // Calculate surplus of cToken2
        // Buy cToken2 in Uniswap with cToken1
        // Refund gas cost with some Token1

        // or

        // Borrow Token2 with cToken1, mint cToken2. Keep track of Treasury debt and act accordingly. Ugh.
    }
}
