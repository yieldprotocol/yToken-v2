// import { formatBytes32String as toBytes32, id } from 'ethers/lib/utils'
// import { BigNumber, BigNumberish } from 'ethers'

export type Contract = any

const WETH9 = artifacts.require('WETH9')
const Dai = artifacts.require('Dai')
const Comptroller = artifacts.require('Comptroller')
const SimplePriceOracle = artifacts.require('SimplePriceOracle')
const WhitePaperInterestRateModel = artifacts.require('WhitePaperInterestRateModel')
const CErc20 = artifacts.require('CErc20')

import {
  toWad,
  MAX,
} from './utils'

export class CompoundEnvironment {
  weth : Contract
  dai : Contract
  comptroller: Contract
  oracle: Contract
  cWeth: Contract
  cDai: Contract

  constructor(
    weth : Contract,
    dai : Contract,
    comptroller: Contract,
    oracle: Contract,
    cWeth: Contract,
    cDai: Contract,
  ) {
    this.weth = weth
    this.dai = dai
    this.comptroller = comptroller
    this.oracle = oracle
    this.cWeth = cWeth
    this.cDai = cDai
  }

  public static async setup() {

    const weth = await WETH9.new()
    const dai = await Dai.new(31337) // Dai.sol takes the chainId
    const comptroller = await Comptroller.new()
    await comptroller._setMaxAssets(MAX)
    const oracle = await SimplePriceOracle.new()
    await comptroller._setPriceOracle(oracle.address)

    const cTokenConfig : any = {
      // ERC20, baseRatePerYear, multiplierPerYear, initialExchangeRate
      cWeth: {
        cToken: null,
        underlying: weth,
        baseRatePerYear: toWad(1.01),
        multiplierPerYear: toWad(1.02),
        initialExchangeRate: toWad(1.03),
        price: toWad(1.04),
      },
      cDai: {
        cToken: null,
        underlying: dai,
        baseRatePerYear: toWad(1.01),
        multiplierPerYear: toWad(1.02),
        initialExchangeRate: toWad(1.03),
        price: toWad(1.04),
      },
    }

    for (let name in cTokenConfig) {
      const interestRateModel = await WhitePaperInterestRateModel.new(
        cTokenConfig[name].baseRatePerYear,
        cTokenConfig[name].multiplierPerYear,
      )

      const cToken = await CErc20.new()
      await cToken.initialize(
        cTokenConfig[name].underlying.address,
        comptroller.address,
        interestRateModel.address,
        cTokenConfig[name].initialExchangeRate,
        name,
        name,
        18,
      )
      cTokenConfig[name].cToken = cToken
      await comptroller._supportMarket(cTokenConfig[name].cToken.address)
      await oracle.setUnderlyingPrice(cTokenConfig[name].cToken.address, cTokenConfig[name].price)
    }

    return new CompoundEnvironment(weth, dai, comptroller, oracle, cTokenConfig.cWeth.cToken, cTokenConfig.cDai.cToken)
  }

  /* public async getDai(user: string, _daiTokens: BigNumberish, _rate: BigNumberish) {
    await this.vat.hope(this.daiJoin.address, { from: user })
    await this.vat.hope(this.wethJoin.address, { from: user })

    const _daiDebt = divrupRay(_daiTokens, _rate).add(2).toString() // For very low values of rate, we can lose up to two wei dai debt, reverting the exit below
    const _wethTokens = divRay(_daiTokens, spot).mul(2).toString() // We post twice the amount of weth needed to remain collateralized after future rate increases

    await this.weth.deposit({ from: user, value: _wethTokens })
    await this.weth.approve(this.wethJoin.address, _wethTokens, { from: user })
    await this.wethJoin.join(user, _wethTokens, { from: user })
    await this.vat.frob(WETH, user, user, user, _wethTokens, _daiDebt, { from: user })
    await this.daiJoin.exit(user, _daiTokens, { from: user })
  }

  // With rounding somewhere, this might get one less chai wei than expected
  public async getChai(user: string, _chaiTokens: BigNumberish, _chi: BigNumberish, _rate: BigNumberish) {
    const _daiTokens = mulRay(_chaiTokens, _chi).add(1)
    await this.getDai(user, _daiTokens, _rate)
    await this.dai.approve(this.chai.address, _daiTokens, { from: user })
    await this.chai.join(user, _daiTokens, { from: user })
  }
}

export class YieldEnvironmentLite {
  maker: MakerEnvironment
  treasury: Contract
  controller: Contract
  eDais: Array<Contract>

  constructor(maker: MakerEnvironment, treasury: Contract, controller: Contract, eDais: Array<Contract>) {
    this.maker = maker
    this.treasury = treasury
    this.controller = controller
    this.eDais = eDais
  }

  public static async setupTreasury(maker: MakerEnvironment) {
    return Treasury.new(
      maker.vat.address,
      maker.weth.address,
      maker.dai.address,
      maker.wethJoin.address,
      maker.daiJoin.address,
      maker.pot.address,
      maker.chai.address
    )
  }

  public static async setupController(treasury: Contract, eDais: Array<Contract>) {
    const eDaiAddrs = eDais.map((c) => c.address)
    const controller = await Controller.new(treasury.address, eDaiAddrs)
    const treasuryFunctions = ['pushDai', 'pullDai', 'pushChai', 'pullChai', 'pushWeth', 'pullWeth'].map((func) =>
      id(func + '(address,uint256)')
    )
    await treasury.batchOrchestrate(controller.address, treasuryFunctions)

    for (const eDai of eDais) {
      await eDai.batchOrchestrate(controller.address, [id('mint(address,uint256)'), id('burn(address,uint256)')])
    }

    return controller
  }

  public static async setupEDais(treasury: Contract, maturities: Array<number>): Promise<Array<Contract>> {
    return await Promise.all(
      maturities.map(async (maturity) => {
        const eDai = await EDai.new(treasury.address, maturity, 'Name', 'Symbol')
        await treasury.orchestrate(eDai.address, id('pullDai(address,uint256)'))
        return eDai
      })
    )
  }

  public static async setup(maturities: Array<number>) {
    const maker = await MakerEnvironment.setup()
    const treasury = await this.setupTreasury(maker)
    const eDais = await this.setupEDais(treasury, maturities)
    const controller = await this.setupController(treasury, eDais)
    return new YieldEnvironmentLite(maker, treasury, controller, eDais)
  }

  public async newEDai(maturity: number, name: string, symbol: string) {
    const eDai = await EDai.new(this.treasury.address, maturity, name, symbol)
    await this.treasury.orchestrate(eDai.address, id('pullDai(address,uint256)'))
    return eDai
  }

  // Convert eth to weth and post it to eDai
  public async postWeth(user: string, _wethTokens: BigNumberish) {
    await this.maker.weth.deposit({ from: user, value: _wethTokens.toString() })
    await this.maker.weth.approve(this.treasury.address, _wethTokens, { from: user })
    await this.controller.post(WETH, user, user, _wethTokens, { from: user })
  }

  // Convert eth to chai and post it to eDai
  public async postChai(user: string, _chaiTokens: BigNumberish, _chi: BigNumberish, _rate: BigNumberish) {
    await this.maker.getChai(user, _chaiTokens, _chi, _rate)
    await this.maker.chai.approve(this.treasury.address, _chaiTokens, { from: user })
    await this.controller.post(CHAI, user, user, _chaiTokens, { from: user })
  }

  // Retrieve the available eDai borrowing power - only works before rate increases
  public async unlockedOf(collateral: string, user: string): Promise<BigNumberish> {
    const debt = await this.controller.totalDebtDai(collateral, user)
    return (await this.controller.powerOf(collateral, user)).sub(debt)
  } */
}

/* export class YieldEnvironment extends YieldEnvironmentLite {
  liquidations: Contract
  unwind: Contract

  constructor(
    maker: MakerEnvironment,
    treasury: Contract,
    controller: Contract,
    eDais: Contract,
    liquidations: Contract,
    unwind: Contract
  ) {
    super(maker, treasury, controller, eDais)
    this.liquidations = liquidations
    this.unwind = unwind
  }

  public static async setup(maturities: Array<number>) {
    const { maker, treasury, controller, eDais } = await YieldEnvironmentLite.setup(maturities)

    const liquidations = await Liquidations.new(controller.address)
    await controller.orchestrate(liquidations.address, id('erase(bytes32,address)'))
    await treasury.batchOrchestrate(liquidations.address, [
      id('pushDai(address,uint256)'),
      id('pullWeth(address,uint256)'),
    ])

    const unwind = await Unwind.new(maker.end.address, liquidations.address)
    await treasury.registerUnwind(unwind.address)
    await controller.orchestrate(unwind.address, id('erase(bytes32,address)'))
    await liquidations.orchestrate(unwind.address, id('erase(address)'))

    for (const eDai of eDais) {
      await eDai.orchestrate(unwind.address, id('burn(address,uint256)'))
    }

    return new YieldEnvironment(maker, treasury, controller, eDais, liquidations, unwind)
  }

  public async shutdown(owner: string, user1: string, user2: string) {
    await this.maker.end.cage()
    await this.maker.end.setTag(WETH, tag)
    await this.maker.end.setDebt(1)
    await this.maker.end.setFix(WETH, fix)
    await this.maker.end.skim(WETH, user1)
    await this.maker.end.skim(WETH, user2)
    await this.maker.end.skim(WETH, owner)
    await this.unwind.unwind()
    await this.unwind.settleTreasury()
    await this.unwind.cashSavings()
  }
} */
