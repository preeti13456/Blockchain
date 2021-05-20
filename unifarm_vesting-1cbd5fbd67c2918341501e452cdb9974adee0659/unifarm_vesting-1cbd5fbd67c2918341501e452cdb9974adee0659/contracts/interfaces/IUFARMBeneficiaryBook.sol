// SPDX-License-Identifier: MIT;

pragma solidity ^0.7.6;

abstract contract IUFARMBeneficiaryBook {
    function isBeneficiary(address account, uint256 insertId)
        public
        view
        virtual
        returns (
            bool,
            address,
            uint256
        );
}
