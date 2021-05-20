import { ethers } from "hardhat";

async function main() {
    const vestToken: string = "0x30148a43c5F0deD8993148a2d3F35B2b2eA54F48";
    // grab the signers
    const [owner] = await ethers.getSigners();
    // factory
    const factory = await ethers.getContractFactory("UnifarmFactory");
    // deploy the factory contract
    const unifarmFactory = await factory.connect(owner).deploy(vestToken);
    // unifarm wait deployed
    await unifarmFactory.deployed();

    console.log(`Unifarm Factory Address ${unifarmFactory.address}`);
}

main();
