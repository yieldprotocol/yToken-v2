const Migrations = artifacts.require('Migrations')
const WETH9 = artifacts.require('WETH9')
const Comptroller = artifacts.require('Comptroller')
const WhitePaperInterestRateModel = artifacts.require('WhitePaperInterestRateModel')
const CErc20 = artifacts.require('CErc20')

const ethers = require('ethers')
const { BigNumber } = require('ethers')

function toWad(value) {
  let exponent = BigNumber.from(10).pow(BigNumber.from(8))
  return BigNumber.from(value * 10 ** 10).mul(exponent)
}

function toRay(value) {
  let exponent = BigNumber.from(10).pow(BigNumber.from(17))
  return BigNumber.from(value * 10 ** 10).mul(exponent)
}

function toRad(value) {
  let exponent = BigNumber.from(10).pow(BigNumber.from(35))
  return BigNumber.from(value * 10 ** 10).mul(exponent)
}

function subBN(x, y) {
  return BigNumber.from(x).sub(BigNumber.from(y))
}

module.exports = async (deployer, network, accounts) => {
  const migrations = await Migrations.deployed()
  const weth = await WETH9.deployed()
  const dai = await Dai.deployed()
  const interestRateModel = await WhitePaperInterestRateModel.deployed()
  const comptroller = await Comptroller.deployed()
  const cWeth  = await CErc20.at(await migrations.contracts(ethers.utils.formatBytes32String('CWeth')))
  const cDai  = await CErc20.at(await migrations.contracts(ethers.utils.formatBytes32String('CDai')))

  me = (await web3.eth.getAccounts())[0]
  MAX = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  WAD = '000000000000000000'

  await comptroller._setMaxAssets(MAX)
  await comptroller._supportMarket(cWeth.address)
  await comptroller._supportMarket(cDai.address)
  console.log("Compound setup")

  await comptroller.enterMarkets([cWeth.address])
  await weth.deposit({ value: "2" + WAD })
  await weth.approve(cWeth.address, MAX)
  await cWeth.mint('1'+WAD)
  console.log("Supplied Weth")

  await comptroller.enterMarkets([cDai.address])
  await dai.mint(me, "250" + WAD)
  await dai.approve(cDai.address, MAX)
  await cDai.mint('250'+WAD)
  console.log("Supplied Dai")
}
