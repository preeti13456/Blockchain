import { ethers } from "hardhat";

async function main() {
    // grab the signers
    const [owner] = await ethers.getSigners();
    // factory
    const factory = await ethers.getContractFactory("UFARMBeneficiaryBook");
    // deploy the factory contract
    const book = await factory.connect(owner).deploy();
    // unifarm wait deployed
    await book.deployed();

    console.log(`Unifarm Beneficiary Book Address ${book.address}`);
}

main();
