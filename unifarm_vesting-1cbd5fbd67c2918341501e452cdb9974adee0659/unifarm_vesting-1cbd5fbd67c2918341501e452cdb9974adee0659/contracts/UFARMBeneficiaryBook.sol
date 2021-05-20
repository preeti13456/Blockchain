// SPDX-License-Identifier: MIT;

pragma solidity ^0.7.6;

import "./access/Ownable.sol";

contract UFARMBeneficiaryBook is Ownable {
    /// @notice mapping for stroring beneficiaries
    mapping(address => Beneficiary[]) public beneficiaries;

    /// @notice struct Beneficiaries for storing beneficiary details
    struct Beneficiary {
        address beneficiaryAddress;
        address vestAddress;
        uint256 claimTokens;
    }

    /// @notice An Activation event occurs on every beneficiary activation.

    event Activated(address account, address vest, uint256 claimTokens, uint256 time);

    /// @notice An Unactivation event occurs on every beneficiary UnActivation.
    event UnActivated(address account, address vest, uint256 time);

    constructor() Ownable(_msgSender()) {}

    /**
     * @notice get block timestamp.
     * @return block timestamp.
     */

    function _getNow() internal view returns (uint256) {
        return block.timestamp;
    }

    /**
     * @notice Activate Single Beneficiary. called by only Owner. revert on zero address.
     * @param account A Beneficiary Address.
     * @param vest vest Address.
     * @param tokens no of claimable tokens.
     */

    function singleActivation(
        address account,
        address vest,
        uint256 tokens
    ) external onlyOwner {
        require(account != address(0), "UFARMBeneficiaryBook: Activation failed");
        require(vest != address(0), "UFARMBeneficiaryBook: Invalid Vesting Address");
        Beneficiary memory holder = Beneficiary(account, vest, tokens);
        beneficiaries[account].push(holder);
        emit Activated(account, vest, tokens, _getNow());
    }

    /**
     * @notice Activate Multiple Beneficiary once. called by only Owner. revert on zero address.
     * @param accounts Array of Beneficiary Address.
     * @param vest Array of vest Address.
     * @param tokens Array of claimTokens which consist no of claimable tokens.
     */

    function multiActivation(
        address[] memory accounts,
        address[] memory vest,
        uint256[] memory tokens
    ) external onlyOwner {
        require(
            accounts.length == vest.length ||
                vest.length == tokens.length ||
                tokens.length == accounts.length,
            "UFARMBeneficiaryBook: Invalid length."
        );

        for (uint8 u = 0; u < vest.length; u++) {
            require(accounts[u] != address(0), "UFARMBeneficiaryBook: Activation failed");
            require(vest[u] != address(0), "UFARMBeneficiaryBook: Invalid Vesting Address");

            beneficiaries[accounts[u]].push(
                Beneficiary({
                    beneficiaryAddress: accounts[u],
                    vestAddress: vest[u],
                    claimTokens: tokens[u]
                })
            );

            emit Activated(accounts[u], vest[u], tokens[u], _getNow());
        }
    }

    /**
     * @notice unActivate Beneficiary from Specific Vesting. called by only Owner. account should not be zero address.
     * @param account A Beneficiary Address.
     * @param index An insertId.
     * @return it returns true on success.
     */

    function unActivate(address account, uint8 index) external onlyOwner returns (bool) {
        require(account != address(0), "UFARMBeneficiaryBook: UnActivation failed");
        delete beneficiaries[account][index];
        emit UnActivated(account, beneficiaries[account][index].vestAddress, _getNow());
        return true;
    }

    /**
     * @notice unActivate Beneficiary from All Vesting. called by only Owner. account should not be zero address.
     * @param account A Beneficiary Address.
     * @return it returns true on success.
     */

    function unActivateForAll(address account) external onlyOwner returns (bool) {
        require(account != address(0), "UFARMBeneficiaryBook: UnActivation failed");
        delete beneficiaries[account];
        return true;
    }

    /**
     * @notice called by the each vesting contract for beneficiary Activation.
     * @param account A Beneficiary Address.
     * @param index An Insert id.
     * @return this will returns beneficiary, vestAddress and his claimable tokens.
     */

    function isBeneficiary(address account, uint256 index)
        public
        view
        returns (
            bool,
            address,
            uint256
        )
    {
        Beneficiary storage holders = beneficiaries[account][index];
        return (holders.beneficiaryAddress == account, holders.vestAddress, holders.claimTokens);
    }

    /**
     * @notice externally called by the frontend to determine his activation on specific vest path.
     * @param account An address of beneficiary.
     * @return length of beneficiaries Array.
     */

    function beneficiaryActivationCount(address account) public view returns (uint256) {
        return beneficiaries[account].length;
    }
}
