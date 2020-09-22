// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.6.10;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ComptrollerInterface.sol";
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

    ComptrollerInterface public comptroller;

    mapping(address => IERC20) public underlyings;
    mapping(address => ICERC20Token) public cTokens;

    constructor(address comptroller_, address[] memory cTokens_) public {
        comptroller = ComptrollerInterface(comptroller_);
        comptroller.enterMarkets(cTokens_); // This takes care of being valid cTokens
        
        for (uint256 i = 0; i < cTokens_.length; i += 1) {
            ICERC20Token _cToken = ICERC20Token(cTokens_[i]);
            address underlying = _cToken.underlying();
            underlyings[cTokens_[i]] = IERC20(underlying);
            cTokens[underlying] = _cToken;    
        }
    }

    /// @dev Grab an ERC20 from the client and use it to mint cToken for the Treasury
    function pushUnderlying(address underlying, address from, uint256 amount)
        public
        onlyOrchestrated("Treasury: Not Authorized")
    {
        // Check a valid underlying
        require(IERC20(underlying).transferFrom(from, address(this), amount), "Treasury: Transfer fail");  // Take underlying from user to Treasury
        cTokens[underlying].mint(amount);
    }

    /// @dev Grab a cToken from the client and keep it in the Treasury
    function pushCToken(address cToken, address from, uint256 amount)
        public
        onlyOrchestrated("Treasury: Not Authorized")
    {
        // Check a valid cToken
        ICERC20Token _cToken = ICERC20Token(cToken);
        _cToken.transferFrom(from, address(this), amount);
        _cToken.redeemUnderlying(amount); // TODO: The parameter is in Dai or cDai? Is it the same?
    }

    /// @dev Redeem a cERC20 from the Treasury and return the underlying to the client
    function pullUnderlying(address underlying, address to, uint256 amount)
        public
        onlyOrchestrated("Treasury: Not Authorized")
    {
        // TODO: Consider a reverse search, so that the underlying is passed as a paraeter and not the cToken
        ICERC20Token _cToken = cTokens[underlying];
        IERC20 _underlying = IERC20(underlying);
        _cToken.redeemUnderlying(amount); // TODO: The parameter is in Dai or cDai? Is it the same?
        require(_underlying.transfer(to, amount));
    }

    /// @dev Transfer a cToken from the Treasury to the client
    function pullCToken(address cToken, address to, uint256 amount)
        public
        onlyOrchestrated("Treasury: Not Authorized")
    {
        // TODO: Borrow if needed
        require(ICERC20Token(cToken).transfer(to, amount));
    }
}
