require('dotenv').config()

class Config {
  constructor() {
    // Solana connection settings - Helius by default for better reliability
    this.heliusApiKey = process.env.HELIUS_API_KEY
    this.rpcUrl = this.heliusApiKey 
      ? `https://mainnet.helius-rpc.com/?api-key=${this.heliusApiKey}`
      : 'https://api.mainnet-beta.solana.com' // Fallback to public RPC
    
    // Funding parameters (can be overridden by CLI)
    this.minSolAmount = parseFloat(process.env.MIN_SOL_AMOUNT || '0.1')
    this.hoursLookback = parseInt(process.env.HOURS_LOOKBACK || '24')
    this.fundingAmountSol = parseFloat(process.env.FUNDING_AMOUNT_SOL || '0.05')
    
    // File paths (can be overridden by CLI)
    this.donorsFile = process.env.DONORS_FILE || '../public/sellers.csv'
    this.recipientsFile = process.env.RECIPIENTS_FILE || '../public/buyers.csv'
    
    // Safety settings
    this.dryRun = process.env.DRY_RUN !== 'false' // Default to true for safety
    this.maxFundingOperations = parseInt(process.env.MAX_FUNDING_OPERATIONS || '10')
    
    this.validate()
  }
  
  validate() {
    if (this.minSolAmount <= 0) {
      throw new Error('MIN_SOL_AMOUNT must be greater than 0')
    }
    
    if (this.hoursLookback <= 0) {
      throw new Error('HOURS_LOOKBACK must be greater than 0')
    }
    
    if (this.fundingAmountSol <= 0) {
      throw new Error('FUNDING_AMOUNT_SOL must be greater than 0')
    }
    
    if (this.maxFundingOperations <= 0) {
      throw new Error('MAX_FUNDING_OPERATIONS must be greater than 0')
    }
  }
  
  // Method to override config with CLI arguments
  override(cliOptions) {
    if (cliOptions.amount !== undefined) {
      this.minSolAmount = parseFloat(cliOptions.amount)
    }
    
    if (cliOptions.hours !== undefined) {
      this.hoursLookback = parseInt(cliOptions.hours)
    }
    
    if (cliOptions.funding !== undefined) {
      this.fundingAmountSol = parseFloat(cliOptions.funding)
    }
    
    if (cliOptions.donors) {
      this.donorsFile = cliOptions.donors
    }
    
    if (cliOptions.recipients) {
      this.recipientsFile = cliOptions.recipients
    }
    
    if (cliOptions.execute) {
      this.dryRun = false
    }
    
    this.validate()
  }
  
  getRpcUrl() {
    return this.rpcUrl
  }
  
  getTimeframeCutoff() {
    const now = new Date()
    const cutoff = new Date(now.getTime() - (this.hoursLookback * 60 * 60 * 1000))
    return cutoff
  }
  
  print() {
    console.log('🔧 Configuration:')
    console.log(`   💰 Minimum SOL amount: ${this.minSolAmount}`)
    console.log(`   ⏰ Hours lookback: ${this.hoursLookback}`)
    console.log(`   💸 Funding amount: ${this.fundingAmountSol} SOL`)
    console.log(`   👥 Donors file: ${this.donorsFile}`)
    console.log(`   📨 Recipients file: ${this.recipientsFile}`)
    console.log(`   🛡️  Dry run: ${this.dryRun ? 'Yes (no actual transactions)' : 'No (REAL TRANSACTIONS)'}`)
    console.log(`   📊 Max funding operations: ${this.maxFundingOperations}`)
    
    const rpcDisplay = this.heliusApiKey 
      ? `Helius RPC (${this.heliusApiKey.slice(0, 8)}...)`
      : 'Public Solana RPC (may have rate limits)'
    console.log(`   🌐 RPC: ${rpcDisplay}`)
    console.log('')
  }
}

module.exports = Config
