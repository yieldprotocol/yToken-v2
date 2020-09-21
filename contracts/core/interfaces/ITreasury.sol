// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.6.10;

import "./IDai.sol";
import "./CTokenInterfaces.sol";

interface ITreasury {
    function pushDai(address, uint256) external;
    function pullDai(address, uint256) external;
    function pushCDai(address, uint256) external;
    function pullCDai(address, uint256) external;
    function shutdown() external;
    function live() external view returns(bool);

    function dai() external view returns (IDai);
    function cDai() external view returns (ICERC20Token);
}
