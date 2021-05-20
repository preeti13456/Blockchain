import { ethers, waffle } from "hardhat";
import chai, { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "@ethersproject/contracts";
import _ from "lodash";
import { formatUnits, parseUnits } from "@ethersproject/units";
import { ContractFunctionVisibility } from "hardhat/internal/hardhat-network/stack-traces/model";

const { solidity } = waffle;
chai.use(solidity);

describe("Unifarm Vesting Contract", () => {
    var owner: SignerWithAddress;

    var UFARM: Contract;
    var factory: Contract;
    var book: Contract;

    var bob: SignerWithAddress;
    var alice: SignerWithAddress;

    before(async () => {
        const [ownerSigner, bobSigner, aliceSigner] = await ethers.getSigners();

        owner = ownerSigner;

        bob = bobSigner;

        alice = aliceSigner;
        // deploy the Unifarm vest token
        const UnifarmTokenFactory = await ethers.getContractFactory("UnifarmToken");
        // deploy UFARM
        const __UFARM = await UnifarmTokenFactory.connect(owner).deploy();
        // wait for deployment
        __UFARM.deployed();

        UFARM = __UFARM;

        const UnifarmFactory = await ethers.getContractFactory("UnifarmFactory");
        // deploy the factory
        const __factory = await UnifarmFactory.connect(owner).deploy(UFARM.address);

        await __factory.deployed();

        factory = __factory;

        // deploy beneficiary contract
        const bookFactory = await ethers.getContractFactory("UFARMBeneficiaryBook");
        const beneficiaryBook = await bookFactory.connect(owner).deploy();
        // waiting for deployment
        await beneficiaryBook.deployed();

        book = beneficiaryBook;
    });

    describe("Factory Functionalities", () => {
        it("create vest contract", async () => {
            const cliff: number = _.multiply(86400, 90);
            const endTime: number = _.multiply(86400, 360);
            const unLockDuration: number = 86400;
            await expect(
                factory.connect(owner).createVest(cliff, endTime, unLockDuration, false)
            ).to.be.emit(factory, "Vested");
        });

        it("create Airdrop with release All functionality", async () => {
            const cliff: number = 0;
            const endTime: number = 86400;
            const unLockDuration: number = 86400;

            await expect(
                factory.connect(owner).createVest(cliff, endTime, unLockDuration, true)
            ).to.be.emit(factory, "Vested");
        });
    });

    describe("Add Beneficiary list and Liquidate Vest Contract", () => {
        it("add beneficiary", async () => {
            const vestedAddress = await factory.vested(0);
            const claimableTokens = ethers.utils.parseUnits("40000", "ether");
            await expect(
                book.connect(owner).singleActivation(bob.address, vestedAddress, claimableTokens)
            ).to.be.emit(book, "Activated");
        });

        it("add beneficiary on airdrop", async () => {
            const vestedAddress = await factory.vested(1);
            const claimableTokens = ethers.utils.parseUnits("40000", "ether");
            await expect(
                book.connect(owner).singleActivation(alice.address, vestedAddress, claimableTokens)
            ).to.be.emit(book, "Activated");
        });

        it("liquidate vest contract", async () => {
            const vestAddress = await factory.vested(0);
            await UFARM.connect(owner).transfer(vestAddress, parseUnits("50000", "ether"));
        });

        it("liquidate Airdrops also", async () => {
            const vestAddress = await factory.vested(1);
            await UFARM.connect(owner).transfer(vestAddress, parseUnits("200000", "ether"));
        });
    });

    describe("Vesting Functionality", () => {
        var unifarmVesting: Contract;
        var airDropVesting: Contract;

        before(async () => {
            const vestAddress = await factory.vested(0);
            const airdropVestAddress = await factory.vested(1);

            const vestingFactory = await ethers.getContractFactory("UnifarmVesting");

            var vestingContract = await vestingFactory.attach(vestAddress);

            var airdropVestingContract = await vestingFactory.attach(airdropVestAddress);

            unifarmVesting = vestingContract;
            airDropVesting = airdropVestingContract;
        });

        describe("View Functions", () => {
            it("have start time less than block timestamp", async () => {
                const blockNumber = await ethers.provider.getBlockNumber();
                const block = await ethers.provider.getBlock(blockNumber);
                const blockTimeStamp = block.timestamp;
                expect(await unifarmVesting.startTime()).to.be.lt(blockTimeStamp);
            });

            it("cliff period is 90 days", async () => {
                const startTime = await unifarmVesting.startTime();
                const cliffDuration = _.add(startTime, _.multiply(90, 86400));
                const cliff = await unifarmVesting.cliff();
                expect(Number(cliff)).to.be.equal(Number(String(cliffDuration)));
            });

            it("endTime duration is one year", async () => {
                const startTime = await unifarmVesting.startTime();
                const duration = _.multiply(360, 86400);
                const actualEndTime = startTime.add(duration);

                const endTime = await unifarmVesting.endTime();
                expect(Number(endTime)).to.be.equal(actualEndTime);
            });
        });

        describe("Set The benficiary Book Address", () => {
            it("non owner access will not able to set the beneficiary book address", async () => {
                await expect(
                    unifarmVesting.connect(alice).setBeneficiaryBook(book.address)
                ).to.be.revertedWith("Ownable: caller is not the owner");
            });

            it("set the beneficiary book address", async () => {
                await unifarmVesting.connect(owner).setBeneficiaryBook(book.address);
            });

            it("match the book address", async () => {
                expect(await unifarmVesting.bookAddress()).to.be.equal(book.address);
            });
        });

        describe("Release Functionality", () => {
            it("beneficiary cannot claim his tokens during cliff duration", async () => {
                await expect(unifarmVesting.connect(bob).release(0)).to.be.revertedWith(
                    "UnifarmVesting: cliff period exeception"
                );
            });

            it("increase the time to 92 days", async () => {
                const gracePeriod = _.multiply(92, 86400);
                await ethers.provider.send("evm_increaseTime", [gracePeriod]);
            });

            it("after 90 days liner unlocking will start", async () => {
                await expect(unifarmVesting.connect(bob).release(0)).to.be.emit(
                    unifarmVesting,
                    "Released"
                );
            });

            it("check the releaseAmount balance", async () => {
                const bobBalance = await UFARM.balanceOf(bob.address);
                const formatted = formatUnits(bobBalance, "ether");

                const actualClaimableAmountByDay = _.divide(40000, 270);
                const actualClaimAmount = _.multiply(actualClaimableAmountByDay, 2);

                expect(Number(formatted).toFixed(2)).to.be.equal(
                    Number(actualClaimAmount).toFixed(2)
                );
            });

            it("check the releaseAmount on vesting side", async () => {
                const beneficiary = await unifarmVesting.beneficiaryDetails(bob.address);
                const formatted = formatUnits(String(beneficiary.releasedTokens), "ether");

                const actualClaimableAmountByDay = _.divide(40000, 270);
                const actualClaimAmount = _.multiply(actualClaimableAmountByDay, 2);

                expect(Number(formatted).toFixed(2)).to.be.equal(
                    Number(actualClaimAmount).toFixed(2)
                );
            });

            it("beneficiary take advantage of releaseAll functionality but its cant", async () => {
                await expect(unifarmVesting.connect(bob).releaseAll(0)).to.be.revertedWith(
                    "UnifarmVesting: invalid attempt"
                );
            });

            it("increase the time for half day", async () => {
                const gracePeriod = _.multiply(0.5, 86400);
                await ethers.provider.send("evm_increaseTime", [gracePeriod]);
            });

            it("now release the token", async () => {
                await expect(unifarmVesting.connect(bob).release(0)).to.be.revertedWith(
                    "UnifarmVesting: You dont have unlocked tokens"
                );
            });

            // now beneficiary after 90 days
            it("increase the time to 90 days", async () => {
                const gracePeriod = _.multiply(90, 86400);
                await ethers.provider.send("evm_increaseTime", [gracePeriod]);
            });

            it("now beneficiary want to release he got 92 days unlocked tokens", async () => {
                await expect(unifarmVesting.connect(bob).release(0)).to.be.emit(
                    unifarmVesting,
                    "Released"
                );
            });

            it("check his release amount after 182 days", async () => {
                const beneficiary = await unifarmVesting.beneficiaryDetails(bob.address);
                const formatted = formatUnits(String(beneficiary.releasedTokens), "ether");

                const actualClaimableAmountByDay = _.divide(40000, 270);

                const actualClaimAmount = _.multiply(actualClaimableAmountByDay, 92);
                expect(Number(formatted).toFixed(2)).to.be.equal(
                    Number(actualClaimAmount).toFixed(2)
                );
            });

            it("increase the time for next 90 days", async () => {
                const gracePeriod = _.multiply(90, 86400);
                await ethers.provider.send("evm_increaseTime", [gracePeriod]);
            });

            it("now beneficiary want to release he got 88 days unlocked tokens", async () => {
                await expect(unifarmVesting.connect(bob).release(0)).to.be.emit(
                    unifarmVesting,
                    "Released"
                );
            });

            it("check his release amount after 272 days", async () => {
                const beneficiary = await unifarmVesting.beneficiaryDetails(bob.address);
                const formatted = formatUnits(String(beneficiary.releasedTokens), "ether");

                const actualClaimableAmountByDay = _.divide(40000, 270);

                const actualClaimAmount = _.multiply(actualClaimableAmountByDay, 182);

                expect(Number(formatted).toFixed(2)).to.be.equal(
                    Number(actualClaimAmount).toFixed(2)
                );
            });

            it("increase the time for next 90 days", async () => {
                const gracePeriod = _.multiply(90, 86400);
                await ethers.provider.send("evm_increaseTime", [gracePeriod]);
            });

            it("now beneficiary want to release he got 90 days unlocked tokens", async () => {
                await expect(unifarmVesting.connect(bob).release(0)).to.be.emit(
                    unifarmVesting,
                    "Released"
                );
            });

            it("check his release amount after 362 days", async () => {
                const beneficiary = await unifarmVesting.beneficiaryDetails(bob.address);
                const formatted = formatUnits(String(beneficiary.releasedTokens), "ether");

                const actualClaimableAmountByDay = _.divide(40000, 270);
                const actualClaimAmount = _.multiply(actualClaimableAmountByDay, 269);

                expect(Number(formatted).toFixed(2)).to.be.equal(
                    Number(actualClaimAmount).toFixed(2)
                );
            });
        });

        describe("Airdrop Full Release Functionaltiy", () => {
            it("have start time less than block timestamp", async () => {
                const blockNumber = await ethers.provider.getBlockNumber();
                const block = await ethers.provider.getBlock(blockNumber);
                const blockTimeStamp = block.timestamp;
                expect(await airDropVesting.startTime()).to.be.lt(blockTimeStamp);
            });

            it("cliff is equal to startTime", async () => {
                const startTime = await airDropVesting.startTime();
                const cliff = await airDropVesting.cliff();
                expect(Number(cliff)).to.be.equal(Number(String(startTime)));
            });

            it("endtime is greater than startTime", async () => {
                const endTime = await airDropVesting.endTime();
                const cliff = await airDropVesting.startTime();
                expect(Number(String(endTime))).to.be.gt(cliff);
            });

            it("set the beneficiary book address", async () => {
                await airDropVesting.connect(owner).setBeneficiaryBook(book.address);
            });

            it("do paused", async () => {
                await expect(airDropVesting.doPause())
                    .emit(airDropVesting, "Paused")
                    .withArgs(owner.address);
            });

            it("check contract status to paused true", async () => {
                expect(await airDropVesting.paused()).to.be.true;
            });

            it("try to release when contract is paused", async () => {
                await expect(airDropVesting.connect(alice).releaseAll(0)).to.be.revertedWith(
                    "Pausable: paused"
                );
            });

            it("do unPaused", async () => {
                await expect(airDropVesting.doUnpause())
                    .emit(airDropVesting, "Unpaused")
                    .withArgs(owner.address);
            });

            it("check contract status to paused false", async () => {
                expect(await airDropVesting.paused()).to.be.false;
            });

            it("cannot call release", async () => {
                await expect(airDropVesting.connect(alice).release(1)).to.be.revertedWith(
                    "UnifarmVesting: invalid attempt"
                );
            });

            it("bob is beneficary of 0 index vesting now he want to try to release from second one", async () => {
                await expect(airDropVesting.connect(bob).releaseAll(0)).to.be.revertedWith(
                    "UnifarmVesting: Invalid Vesting Address"
                );
            });

            it("valid beneficiary try to release his airdrop claimable amount", async () => {
                await expect(airDropVesting.connect(alice).releaseAll(0)).to.be.emit(
                    airDropVesting,
                    "Released"
                );
            });

            it("view Released Tokens", async () => {
                const aliceBalance = await UFARM.balanceOf(alice.address);
                expect(Number(formatUnits(String(aliceBalance), "ether"))).to.be.equal(40000);
            });

            it("check view Released Tokens on Vesting Contract", async () => {
                const beneficiary = await airDropVesting.beneficiaryDetails(alice.address);
                const formatted = formatUnits(String(beneficiary.releasedTokens), "ether");
                expect(Number(formatted)).to.be.equal(40000);
            });

            it("alice try again and got reverted", async () => {
                await expect(airDropVesting.connect(alice).releaseAll(0)).to.be.revertedWith(
                    "UnifarmVesting: no claimable tokens remains"
                );
            });

            it("only owner access can safeWithdraw vest tokens", async () => {
                const tokens = ethers.utils.parseUnits("5000", "ether");
                await expect(airDropVesting.connect(alice).safeWithdraw(tokens)).to.be.revertedWith(
                    "Ownable: caller is not the owner"
                );
            });

            it("owner cannot withdraw more than contract token balance", async () => {
                const tokens = ethers.utils.parseUnits("1200000", "ether");
                await expect(airDropVesting.connect(owner).safeWithdraw(tokens)).to.be.revertedWith(
                    "UnifarmVesting: Insufficient Balance"
                );
            });

            it("safeWithdraw vest tokens", async () => {
                const tokens = ethers.utils.parseUnits("5000", "ether");
                await expect(airDropVesting.connect(owner).safeWithdraw(tokens)).to.be.emit(
                    airDropVesting,
                    "Withdrawal"
                );
            });
        });
    });
});
