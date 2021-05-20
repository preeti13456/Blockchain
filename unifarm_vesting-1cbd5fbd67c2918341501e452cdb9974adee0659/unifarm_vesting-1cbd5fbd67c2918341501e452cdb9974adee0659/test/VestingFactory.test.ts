import { ethers, waffle } from "hardhat";
import chai, { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "@ethersproject/contracts";
import _ from "lodash";

describe("Vesting Factory", () => {
    var UFARM: Contract;
    var Factory: Contract;

    var owner;
    var alice;
    before(async () => {
        // grab the signers
        const [ownerSigner, aliceSigner] = await ethers.getSigners();

        owner = ownerSigner;
        alice = aliceSigner;

        // deploy the Unifarm vest token
        const UnifarmTokenFactory = await ethers.getContractFactory("UnifarmToken");
        // deploy UFARM
        const __UFARM = await UnifarmTokenFactory.connect(owner).deploy();
        // wait for deployment
        __UFARM.deployed();

        UFARM = __UFARM;

        // deploy factory contract
        const vestingFactory = await ethers.getContractFactory("UnifarmFactory");

        const factoryContract = await vestingFactory.connect(owner).deploy(UFARM.address);

        // wait for deployment
        await factoryContract.deployed();

        Factory = factoryContract;
    });

    describe("Factory Contract", () => {
        it("non owner access will be reverted", async () => {
            const cliff: number = _.multiply(86400, 90);
            const endTime: number = _.multiply(86400, 360);
            const unLockDuration: number = 86400;
            await expect(
                Factory.connect(alice).createVest(cliff, endTime, unLockDuration, false)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("create vesting schedule", async () => {
            // create vest
            const cliff: number = _.multiply(86400, 90);
            const endTime: number = _.multiply(86400, 360);
            const unLockDuration: number = 86400;
            await expect(
                Factory.connect(owner).createVest(cliff, endTime, unLockDuration, false)
            ).to.be.emit(Factory, "Vested");
        });

        it("get correct vestToken Address", async () => {
            expect(await Factory.vestToken()).to.be.equal(UFARM.address);
        });

        it("get number of Active Vesting Schdules", async () => {
            expect(await Factory.getVestLength()).to.be.equal(1);
        });
    });
});
