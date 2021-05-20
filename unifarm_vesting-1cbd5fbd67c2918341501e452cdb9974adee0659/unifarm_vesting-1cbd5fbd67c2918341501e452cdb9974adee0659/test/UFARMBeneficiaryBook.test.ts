import { ethers, waffle } from "hardhat";
import chai, { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "@ethersproject/contracts";
import _ from "lodash";

const { solidity } = waffle;
// use chai middleware
chai.use(solidity);

var zeroAddress: string = "0x0000000000000000000000000000000000000000";
var owner: SignerWithAddress;
var alice: SignerWithAddress;
var john: SignerWithAddress;

var book: Contract;
var unifarmFactory: Contract;
var UFARM: Contract;

describe("UFARMBeneficiary Book Contract Functionalities", () => {
    before(async () => {
        // grab the signers
        const [ownerSigner, aliceSigner, johnSigner] = await ethers.getSigners();
        owner = ownerSigner;
        alice = aliceSigner;
        john = johnSigner;
        // deploy beneficiary contract
        const bookFactory = await ethers.getContractFactory("UFARMBeneficiaryBook");
        const beneficiaryBook = await bookFactory.connect(owner).deploy();
        // waiting for deployment
        await beneficiaryBook.deployed();

        book = beneficiaryBook;

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

        unifarmFactory = factoryContract;
    });

    describe("Create Vest Functionality", () => {
        it("Create Team Vesting", async () => {
            const cliff: number = _.multiply(86400, 90);
            const endTime: number = _.multiply(86400, 360);
            const unLockDuration: number = 86400;
            await expect(
                unifarmFactory.connect(owner).createVest(cliff, endTime, unLockDuration, false)
            ).to.be.emit(unifarmFactory, "Vested");
        });

        it("Create Advisory Vesting", async () => {
            const cliff: number = _.multiply(86400, 360);
            const endTime: number = _.multiply(86400, 720);
            const unLockDuration: number = 90;
            await expect(
                unifarmFactory.connect(owner).createVest(cliff, endTime, unLockDuration, false)
            ).to.be.emit(unifarmFactory, "Vested");
        });
    });

    describe("Beneficiary Activation Functionality Single Beneficiary", () => {
        it("non owner role can't able to do beneficiary activation", async () => {
            const vestedAddress = await unifarmFactory.vested(0);
            const claimableTokens = ethers.utils.parseUnits("50000", "ether");
            await expect(
                book.connect(alice).singleActivation(john.address, vestedAddress, claimableTokens)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should be santize zero beneficiary address", async () => {
            const vestedAddress = await unifarmFactory.vested(0);
            const claimableTokens = ethers.utils.parseUnits("50000", "ether");
            await expect(
                book.connect(owner).singleActivation(zeroAddress, vestedAddress, claimableTokens)
            ).to.be.revertedWith("UFARMBeneficiaryBook: Activation failed");
        });

        it("should be santize zero vest address", async () => {
            const claimableTokens = ethers.utils.parseUnits("50000", "ether");
            await expect(
                book.connect(owner).singleActivation(john.address, zeroAddress, claimableTokens)
            ).to.be.revertedWith("UFARMBeneficiaryBook: Invalid Vesting Address");
        });

        it("owner can able to do beneficiary activation", async () => {
            const vestedAddress = await unifarmFactory.vested(0);
            const claimableTokens = ethers.utils.parseUnits("30000", "ether");
            await expect(
                book.connect(owner).singleActivation(john.address, vestedAddress, claimableTokens)
            ).to.be.emit(book, "Activated");
        });
    });

    describe("Read Beneficiary", () => {
        it("now john added into team beneficiary list", async () => {
            const beneficiary = await book.isBeneficiary(john.address, 0);
            const vestedAddress = await unifarmFactory.vested(0);
            expect(beneficiary[0]).to.be.true;
            expect(beneficiary[1]).to.equal(vestedAddress);
            expect(Number(ethers.utils.formatUnits(beneficiary[2], "ether"))).to.equal(30000);
        });

        it("view alice beneficiary details its not added yet & surely reverted", async () => {
            await expect(book.isBeneficiary(alice.address, 0)).to.be.reverted;
        });

        it("get john details from beneficiary list", async () => {
            const beneficiaryDetails = await book.beneficiaries(john.address, 0);
            const vestedAddress = await unifarmFactory.vested(0);
            expect(beneficiaryDetails.beneficiaryAddress).to.be.equal(john.address);
            expect(beneficiaryDetails.vestAddress).to.be.equal(vestedAddress);
            expect(
                Number(ethers.utils.formatUnits(beneficiaryDetails.claimTokens, "ether"))
            ).to.equal(30000);
        });
    });

    describe("Multiple Beneficiary Functionality", () => {
        // this block usefull when we have multiple request for beneficiaries.

        it("only owner role can able to add multiple beneficiary", async () => {
            const Team = await unifarmFactory.vested(0);
            const Advisory = await unifarmFactory.vested(1);

            const TeamTokens = ethers.utils.parseUnits("40000", "ether");
            const AdvisoryTokens = ethers.utils.parseUnits("20000", "ether");

            await expect(
                book
                    .connect(alice)
                    .multiActivation(
                        [alice.address, john.address],
                        [Team, Advisory],
                        [TeamTokens, AdvisoryTokens]
                    )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("revert on beneficiary zero address", async () => {
            const Team = await unifarmFactory.vested(0);
            const Advisory = await unifarmFactory.vested(1);

            const TeamTokens = ethers.utils.parseUnits("40000", "ether");
            const AdvisoryTokens = ethers.utils.parseUnits("20000", "ether");

            await expect(
                book
                    .connect(owner)
                    .multiActivation(
                        [alice.address, zeroAddress],
                        [Team, Advisory],
                        [TeamTokens, AdvisoryTokens]
                    )
            ).to.be.revertedWith("UFARMBeneficiaryBook: Activation failed");
        });

        it("revert on vestAddress zero address", async () => {
            const Team = await unifarmFactory.vested(0);

            const TeamTokens = ethers.utils.parseUnits("40000", "ether");
            const AdvisoryTokens = ethers.utils.parseUnits("20000", "ether");

            await expect(
                book
                    .connect(owner)
                    .multiActivation(
                        [alice.address, john.address],
                        [Team, zeroAddress],
                        [TeamTokens, AdvisoryTokens]
                    )
            ).to.be.revertedWith("UFARMBeneficiaryBook: Invalid Vesting Address");
        });

        it("add multiple beneficiary once", async () => {
            const Team = await unifarmFactory.vested(0);
            const Advisory = await unifarmFactory.vested(1);

            const TeamTokens = ethers.utils.parseUnits("40000", "ether");
            const AdvisoryTokens = ethers.utils.parseUnits("20000", "ether");

            await expect(
                book.multiActivation(
                    [alice.address, john.address],
                    [Team, Advisory],
                    [TeamTokens, AdvisoryTokens]
                )
            ).to.be.emit(book, "Activated");
        });
    });

    describe("After Added Multiple Beneficiary Checking Getters", () => {
        it("alice have added into advisory beneficiary list", async () => {
            const beneficiary = await book.isBeneficiary(alice.address, 0);
            const Team = await unifarmFactory.vested(0);
            expect(beneficiary[0]).to.be.true;
            expect(beneficiary[1]).to.be.equal(Team);
            expect(Number(ethers.utils.formatUnits(beneficiary[2], "ether"))).to.equal(40000);
        });

        it("john have added into advisory beneficiary list", async () => {
            const beneficiary = await book.isBeneficiary(john.address, 1);
            const Advisory = await unifarmFactory.vested(1);
            expect(beneficiary[0]).to.be.true;
            expect(beneficiary[1]).to.be.equal(Advisory);
            expect(Number(ethers.utils.formatUnits(beneficiary[2], "ether"))).to.equal(20000);
        });

        it("get alice details from beneficiary list", async () => {
            const beneficiaryDetails = await book.beneficiaries(alice.address, 0);
            const vestedAddress = await unifarmFactory.vested(0);
            expect(beneficiaryDetails.beneficiaryAddress).to.be.equal(alice.address);
            expect(beneficiaryDetails.vestAddress).to.be.equal(vestedAddress);
            expect(
                Number(ethers.utils.formatUnits(beneficiaryDetails.claimTokens, "ether"))
            ).to.equal(40000);
        });
    });

    describe("View Functionality", () => {
        it("John Participated in Team & Advisory", async () => {
            expect(await book.beneficiaryActivationCount(john.address)).to.be.equal(2);
        });
    });

    describe("UnActivation Functionlity", () => {
        it("unregister john from advisory beneficiary book", async () => {
            await expect(book.connect(owner).unActivate(john.address, 1)).to.be.emit(
                book,
                "UnActivated"
            );
        });

        it("john is no more participant of Advisory Vesting", async () => {
            const beneficiary = await book.isBeneficiary(john.address, 1);
            expect(beneficiary[0]).to.be.false;
            expect(Number(ethers.utils.formatUnits(beneficiary[1], "ether"))).to.equal(0);
        });

        it("UnActivate from all type of Vesting", async () => {
            await book.connect(owner).unActivateForAll(alice.address);
        });

        it("alice is no more participant for all UFARM Vesting", async () => {
            await expect(book.isBeneficiary(alice.address, 0)).to.be.reverted;
        });
    });

    describe("Dual Ownership Functionality", () => {
        it("owner ??", async () => {
            expect(await book.owner()).to.be.equal(owner.address);
        });

        it("super Admin ??", async () => {
            expect(await book.superAdmin()).to.be.equal(owner.address);
        });

        it("transfer Ownership", async () => {
            await expect(book.connect(owner).transferOwnership(alice.address))
                .to.be.emit(book, "OwnershipTransferred")
                .withArgs(owner.address, alice.address);
        });

        it("alice is owner now", async () => {
            expect(await book.owner()).to.be.equal(alice.address);
        });

        it("admin can renounce Ownership any Time", async () => {
            await expect(book.connect(owner).renounceOwnership())
                .to.be.emit(book, "OwnershipTransferred")
                .withArgs(alice.address, owner.address);
        });

        it("now check the owner", async () => {
            expect(await book.owner()).to.be.equal(owner.address);
        });
    });
});
