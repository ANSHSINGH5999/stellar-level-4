const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  console.log("=".repeat(60));
  console.log("Stellar DeFi Platform — Deployment");
  console.log("=".repeat(60));
  console.log(`Network:   ${networkName}`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(
    `Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`
  );
  console.log("=".repeat(60));

  // ── 1. Deploy StellarToken ────────────────────────────────────────────────
  console.log("\n[1/3] Deploying StellarToken...");
  const StellarToken = await ethers.getContractFactory("StellarToken");
  const token = await StellarToken.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  const tokenTx = token.deploymentTransaction().hash;
  console.log(`  ✓ StellarToken deployed: ${tokenAddress}`);
  console.log(`    TX: ${tokenTx}`);

  // ── 2. Deploy StellarStaking ──────────────────────────────────────────────
  console.log("\n[2/3] Deploying StellarStaking...");
  const StellarStaking = await ethers.getContractFactory("StellarStaking");
  const staking = await StellarStaking.deploy(tokenAddress, deployer.address);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  const stakingTx = staking.deploymentTransaction().hash;
  console.log(`  ✓ StellarStaking deployed: ${stakingAddress}`);
  console.log(`    TX: ${stakingTx}`);

  // ── 3. Link contracts ─────────────────────────────────────────────────────
  console.log("\n[3/3] Linking contracts...");
  const linkTx = await token.setStakingContract(stakingAddress);
  await linkTx.wait();
  console.log(`  ✓ StellarToken.stakingContract set to StellarStaking`);
  console.log(`    TX: ${linkTx.hash}`);

  // ── Save deployment info ──────────────────────────────────────────────────
  const deployment = {
    network: networkName,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      StellarToken: {
        address: tokenAddress,
        deployTx: tokenTx,
      },
      StellarStaking: {
        address: stakingAddress,
        deployTx: stakingTx,
      },
    },
    transactions: {
      linkContracts: linkTx.hash,
    },
  };

  // Save to file
  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${networkName}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log(`\n  ✓ Deployment info saved to deployments/${networkName}.json`);

  // Copy ABIs to frontend
  const frontendAbiDir = path.join(__dirname, "..", "frontend", "src", "abis");
  if (!fs.existsSync(frontendAbiDir)) fs.mkdirSync(frontendAbiDir, { recursive: true });

  const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts");
  const tokenAbi = require(path.join(artifactsDir, "StellarToken.sol", "StellarToken.json")).abi;
  const stakingAbi = require(path.join(artifactsDir, "StellarStaking.sol", "StellarStaking.json")).abi;

  fs.writeFileSync(path.join(frontendAbiDir, "StellarToken.json"), JSON.stringify({ abi: tokenAbi, address: tokenAddress }, null, 2));
  fs.writeFileSync(path.join(frontendAbiDir, "StellarStaking.json"), JSON.stringify({ abi: stakingAbi, address: stakingAddress }, null, 2));
  console.log("  ✓ ABIs copied to frontend/src/abis/");

  console.log("\n" + "=".repeat(60));
  console.log("Deployment complete!");
  console.log(`StellarToken:  ${tokenAddress}`);
  console.log(`StellarStaking: ${stakingAddress}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
