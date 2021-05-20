// SPDX-License-Identifier: MIT;

pragma solidity ^0.7.6;

import "./libraries/SafeERC20.sol";
import "./access/Ownable.sol";
import "./libraries/SafeMath.sol";
import "./interfaces/IUFARMBeneficiaryBook.sol";

/**
 * @title Unifarm Vesting Contract
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme.
 * @author OpenDefi by Oropocket.
 */

contract UnifarmVesting is Ownable {
    /// @notice use of SafeMath for mathematics operations.
    using SafeMath for uint256;

    /// @notice use SafeERC20 for IERC20 (interface of ERC20).
    using SafeERC20 for IERC20;

    /// @notice event Released emit on every release which is called by Valid Beneficiary of UFARM.
    event Released(address indexed beneficiary, uint256 amount, uint256 time);

    /// @notice event Withdrawal emit on every SafeWithdraw.
    event Withdrawal(address indexed account, uint256 amount, uint256 time);

    /// @notice when actually token released will be start.
    uint256 public cliff;

    /// @notice vesting start time.
    uint256 public startTime;

    /// @notice vesting end time.
    uint256 public endTime;

    /// @notice A struct to store beneficiary details.
    struct Beneficiary {
        uint256 claimTokens;
        uint256 releasedTokens;
        uint256 lastRelease;
    }

    /// @notice store beneficiary details by its address.
    mapping(address => Beneficiary) public beneficiaryDetails;

    /// @notice linear unlocking duration. every period token released.
    uint256 public unlockDuration;

    /// @notice UFARM vestToken Address.
    IERC20 public vestToken;

    /// @notice UFARM Beneficiary Book Address.
    address public bookAddress;

    /// @notice allowReleaseAll works on special condition when there is no vesting schedule. eg Airdrop.
    bool public allowReleaseAll;

    /**
     * @notice construct a UFARM Vesting Contract. endTime should be greater than cliff period.
     * @param owner_ owner Address Provided by factory contract.
     * @param cliff_ cliff duration in seconds. eg 30**86400 for 30 days cliff duration.
     * @param startTime_ when will be vesting start provided by factory contract.
     * @param endTime_ when vesting going to be end. eg 360**86400 for 1 year.
     * @param unlockDuration_ duration of linear unlocking. eg 86400 for 1 day linear unlocking.
     * @param vestToken_ vesToken Address. this will be UFARM Token.
     * @param allowReleaseAll_ allow release All once.
     */

    constructor(
        address owner_,
        uint256 cliff_,
        uint256 startTime_,
        uint256 endTime_,
        uint256 unlockDuration_,
        IERC20 vestToken_,
        bool allowReleaseAll_
    ) Ownable(owner_) {
        require(
            endTime_ > cliff_,
            "UnifarmVesting: endTime_ should be greater than cliff_ duration."
        );

        cliff = cliff_;
        startTime = startTime_;
        endTime = endTime_;
        unlockDuration = unlockDuration_;
        vestToken = vestToken_;
        allowReleaseAll = allowReleaseAll_;
    }

    /**
     * @notice Transfers vested tokens to beneficiary. function will fail when invalid or unverified beneficiary try this method external from smart contract
     * @notice function will failed on when allow release All disabled.
     * @notice beneficiary will be derived from UFARMBeneficiaryBook Contract.
     * @param insertId insertId of beneficiary.
     */

    function releaseAll(uint256 insertId) external whenNotPaused {
        require(allowReleaseAll, "UnifarmVesting: invalid attempt");

        (bool isBeneficiary, address vestAddress, uint256 claimTokens) =
            IUFARMBeneficiaryBook(bookAddress).isBeneficiary(_msgSender(), insertId);
        require(isBeneficiary, "UnifarmVesting: Invalid Beneficiary");
        require(vestAddress == address(this), "UnifarmVesting: Invalid Vesting Address");
        require(
            beneficiaryDetails[_msgSender()].releasedTokens < claimTokens,
            "UnifarmVesting: no claimable tokens remains"
        );

        beneficiaryDetails[_msgSender()].releasedTokens = beneficiaryDetails[_msgSender()]
            .releasedTokens
            .add(claimTokens);
        beneficiaryDetails[_msgSender()].lastRelease = block.timestamp;

        require(
            IERC20(vestToken).balanceOf(address(this)) > claimTokens,
            "UnifarmVesting: insufficient balance"
        );
        vestToken.safeTransfer(_msgSender(), claimTokens);
        emit Released(_msgSender(), claimTokens, _getNow());
    }

    /**
     * @notice Transfers vested tokens to beneficiary. function will fail when invalid or unverified beneficiary try this method external from smart contract
     * @notice function will fail on when beneficiary try to release during cliff period and vest address should be this address to check if beneficiary is from valid vest or not..
     * @notice beneficiary will be derived from UFARMBeneficiaryBook Contract.
     * @param insertId insertId of beneficiary.
     */

    function release(uint256 insertId) external whenNotPaused {
        require(!allowReleaseAll, "UnifarmVesting: invalid attempt");
        (bool isBeneficiary, address vestAddress, uint256 claimTokens) =
            IUFARMBeneficiaryBook(bookAddress).isBeneficiary(_msgSender(), insertId);

        require(isBeneficiary, "UnifarmVesting: Invalid Beneficiary");
        require(vestAddress == address(this), "UnifarmVesting: Invalid Vesting Address");
        require(block.timestamp >= cliff, "UnifarmVesting: cliff period exeception");

        require(
            beneficiaryDetails[_msgSender()].releasedTokens <= claimTokens,
            "UnifarmVesting: no claimable tokens remains"
        );

        uint256 unlockedTokens = getUnlockedTokens(_msgSender(), claimTokens);
        distribute(_msgSender(), unlockedTokens);
    }

    /**
     * @notice distribution of tokens. it may be failed on insufficient balance or when user have no unlocked token.
     * @param holder A beneficiary Address.
     * @param unlockedTokens No of Unlocked Tokens.
     */

    function distribute(address holder, uint256 unlockedTokens) internal {
        if (unlockedTokens > 0) {
            beneficiaryDetails[holder].releasedTokens = beneficiaryDetails[holder]
                .releasedTokens
                .add(unlockedTokens);
            beneficiaryDetails[holder].lastRelease = block.timestamp;

            require(
                IERC20(vestToken).balanceOf(address(this)) > unlockedTokens,
                "UnifarmVesting: insufficient balance"
            );
            vestToken.safeTransfer(holder, unlockedTokens);
            emit Released(holder, unlockedTokens, block.timestamp);
        } else {
            revert("UnifarmVesting: You dont have unlocked tokens");
        }
    }

    /**
     * @notice derived block timestamp.
     * @return block timestamp.
     */

    function _getNow() internal view returns (uint256) {
        return block.timestamp;
    }

    /**
    * @notice A View Function for calculating unlock tokens of beneficiary.
     * @notice We have impose very fancy math here
               if block.timestamp >= endTime `endTime.sub(lastRelease).div(unlockDuration).mul(eachPeriod)`       
               else `_getNow().sub(lastRelease).div(unlockDuration).mul(eachPeriod)`     
     * @return unlockedTokens (Beneficiary Unlocked Tokens).
     */

    function getUnlockedTokens(address holder, uint256 claimableTokens)
        internal
        view
        returns (uint256 unlockedTokens)
    {
        Beneficiary storage user = beneficiaryDetails[holder];

        uint256 tokens = paymentSpliter(claimableTokens);
        uint256 lastRelease = user.lastRelease > 0 ? user.lastRelease : cliff;

        uint256 eachPeriod = unlockDuration.div(1 days);

        uint256 unlockedDays =
            _getNow() >= endTime
                ? ~~endTime.sub(lastRelease).div(unlockDuration).mul(eachPeriod)
                : ~~_getNow().sub(lastRelease).div(unlockDuration).mul(eachPeriod);

        unlockedTokens = tokens.mul(unlockedDays);
    }

    /**
     * @notice payment spliter claim-tokens/diff
     * @param claim total claimble tokens.
     * @return tokens no Of tokens he receive every unlock duration.
     */
    function paymentSpliter(uint256 claim) internal view returns (uint256 tokens) {
        uint256 diff = ~~endTime.sub(cliff);
        tokens = claim.div(diff.div(unlockDuration));
    }

    /**
     * @notice set UFARM Beneficiary Address. called by only Owner.
     * @param bookAddress_ UFARM Beneficiary Book Address.
     */

    function setBeneficiaryBook(address bookAddress_) external onlyOwner {
        bookAddress = bookAddress_;
    }

    /**
     * @notice safe Withdraw Vest Tokens which is called by only Owner. function will failed on insufficient contract balance.
     * @param noOfTokens number of tokens to withdraw.
     */
    function safeWithdraw(uint256 noOfTokens) external onlyOwner {
        require(
            vestToken.balanceOf(address(this)) >= noOfTokens,
            "UnifarmVesting: Insufficient Balance"
        );
        // send the tokens
        vestToken.safeTransfer(owner, noOfTokens);
        emit Withdrawal(owner, noOfTokens, _getNow());
    }

    /**
     * @notice for security concern we will paused this contract.
     * @return true when not paused.
     */

    function doPause() external onlyOwner returns (bool) {
        _pause();
        return true;
    }

    /**
     * @notice vice-versa action like pause.
     * @return true when paused.
     */

    function doUnpause() external onlyOwner returns (bool) {
        _unpause();
        return true;
    }
}
