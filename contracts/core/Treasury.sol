// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.6.10;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ComptrollerInterface.sol";
import "./interfaces/CTokenInterfaces.sol";
import "./interfaces/IDai.sol";
import "./helpers/DecimalMath.sol";
import "./helpers/Orchestrated.sol";
import "@nomiclabs/buidler/console.sol";


/**
 * @dev Treasury manages asset transfers between all contracts in the Yield Protocol and external token contracts.
 * Treasury doesn't have any transactional functions available for regular users.
 * All transactional methods are to be available only for orchestrated contracts.
 */
contract Treasury is Orchestrated(), DecimalMath {

    ComptrollerInterface public comptroller;

    mapping(address => IERC20) public underlyings;
    mapping(address => ICERC20Token) public cTokens;

    modifier validUnderlying(address underlying) {
        require(address(cTokens[underlying]) != address(0), "Treasury: Invalid underlying");
        _;
    }

    modifier validCToken(address cToken) {
        require(address(underlyings[cToken]) != address(0), "Treasury: Invalid cToken");
        _;
    }

    constructor(address comptroller_, address[] memory cTokens_) public {
        comptroller = ComptrollerInterface(comptroller_);
        comptroller.enterMarkets(cTokens_); // This takes care of being valid cTokens
        
        for (uint256 i = 0; i < cTokens_.length; i += 1) {
            ICERC20Token _cToken = ICERC20Token(cTokens_[i]);
            IERC20 underlying = IERC20(_cToken.underlying());
            underlyings[address(_cToken)] = underlying;
            cTokens[address(underlying)] = _cToken;
            underlying.approve(address(_cToken), uint256(-1));
        }
    }

    /// @dev Grab an ERC20 from the client and use it to mint cToken for the Treasury
    function pushUnderlying(address underlying, address from, uint256 amount)
        public
        validUnderlying(underlying)
        onlyOrchestrated("Treasury: Not Authorized")
    {
        require(IERC20(underlying).transferFrom(from, address(this), amount), "Treasury: Transfer fail");
        require(cTokens[underlying].mint(amount) == 0, "Treasury: cToken mint fail");
    }

    /// @dev Grab a cToken from the client and keep it in the Treasury
    function pushCToken(address cToken, address from, uint256 amount)
        public
        validCToken(cToken)
        onlyOrchestrated("Treasury: Not Authorized")
    {
        ICERC20Token _cToken = ICERC20Token(cToken);
        require(_cToken.transferFrom(from, address(this), amount), "Treasury: Transfer fail");
        _cToken.redeemUnderlying(amount); // TODO: The parameter is in Dai or cDai? Is it the same?
    }

    /// @dev Redeem a cERC20 from the Treasury and return the underlying to the client
    function pullUnderlying(address underlying, address to, uint256 amount)
        public
        validUnderlying(underlying)
        onlyOrchestrated("Treasury: Not Authorized")
    {
        ICERC20Token _cToken = cTokens[underlying];
        IERC20 _underlying = IERC20(underlying);
        _cToken.redeemUnderlying(amount); // TODO: The parameter is in Dai or cDai? Is it the same?
        require(_underlying.transfer(to, amount), "Treasury: Transfer fail");
    }

    /// @dev Transfer a cToken from the Treasury to the client
    function pullCToken(address cToken, address to, uint256 amount)
        public
        validCToken(cToken)
        onlyOrchestrated("Treasury: Not Authorized")
    {
        // TODO: Borrow if needed
        require(ICERC20Token(cToken).transfer(to, amount), "Treasury: Transfer fail");
    }
}
