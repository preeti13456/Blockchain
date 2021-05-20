// SPDX-License-Identifier: MIT;

pragma solidity ^0.7.6;

import "./access/Ownable.sol";
import "./UnifarmVesting.sol";
import "./libraries/SafeMath.sol";

/**
 * @title Unifarm Factory
 * @dev Unifarm factory for deploying diffrent investor vesting contracts with multiple beneficiary functionality.
 * @author Opendefi by Oropocket.
 */

contract UnifarmFactory is Ownable {
    /// @notice using dafemath for maticmatics operations in soldity.
    using SafeMath for uint256;

    /// @notice Vested Array to store Multiple Vesting Addresses.
    address[] public vested;

    /// @notice vestToken Address basically UNIFARM TOKEN.
    IERC20 public vestToken;

    /// @notice event Vested emitted on every createVest.
    event Vested(address vestAddress, uint256 time);

    /**
    @notice construct UnifarmFactory Contract.
    @param vestToken_ vestToken Address. 
     */

    constructor(IERC20 vestToken_) Ownable(_msgSender()) {
        vestToken = vestToken_;
    }

    /**
     * @notice contract owner can create and deploy multiple vest contracts with multiple beneficiaries functionality inbuilt locking.
     * @dev can be called by onlyOwner.
     * @param endTime vesting endTime in EPOCH.
     * @param cliff duration when claim starts.
     * @param unlockDuration every liner unlocking schedule in seconds.
     * @param allowReleaseAll allow release All once.
     * @return vestAddress A vesting address.
     */

    function createVest(
        uint256 cliff,
        uint256 endTime,
        uint256 unlockDuration,
        bool allowReleaseAll
    ) external onlyOwner returns (address vestAddress) {
        uint256 startTime = block.timestamp;

        vestAddress = address(
            new UnifarmVesting(
                _msgSender(),
                startTime.add(cliff),
                startTime,
                startTime.add(endTime),
                unlockDuration,
                vestToken,
                allowReleaseAll
            )
        );

        vested.push(vestAddress);
        emit Vested(vestAddress, block.timestamp);
    }

    /**
    @notice get the vest child contracts length.
    @return length of vested array. 
     */

    function getVestLength() public view returns (uint256) {
        return vested.length;
    }
}
