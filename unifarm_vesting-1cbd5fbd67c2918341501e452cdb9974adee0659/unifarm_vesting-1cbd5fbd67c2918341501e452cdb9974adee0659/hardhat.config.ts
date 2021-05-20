import { HardhatUserConfig } from "hardhat/config";
import { config } from "dotenv";

// import plugins
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";

import "solidity-coverage";
import "hardhat-gas-reporter";

// set the configuration
config();

const RPC_URL: string = <string>process.env.RPC_URL;
const PRIVATE_KEY: string = process.env.PRIVATE_KEY as string;
const BSC_API_KEY: string = <string>process.env.BSC_API_KEY;

const hardhatConfig: HardhatUserConfig = {
    defaultNetwork: "localhost",
    networks: {
        hardhat: {},
        localhost: {
            url: "http://localhost:8545",
        },
        testnet: {
            url: RPC_URL,
            accounts: [PRIVATE_KEY],
            chainId: 97,
            gas: 800000,
        },
    },
    solidity: {
        version: "0.7.6",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    etherscan: {
        apiKey: BSC_API_KEY,
    },
    mocha: {
        color: true,
        timeout: 10000,
    },
    gasReporter: {
        currency: "usd",
    },
};

export default hardhatConfig;
