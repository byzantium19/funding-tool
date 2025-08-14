#!/usr/bin/env node

const { Command } = require('commander')
const Config = require('./config')
const FileParser = require('./file-parser')
const TransactionChecker = require('./transaction-checker')
const WalletFunder = require('./wallet-funder')

const program = new Command()

program
  .name('wallet-funding-cli')
  .description('CLI tool to check and fund wallets based on transaction history')
  .version('1.0.0')

program
  .option('-a, --amount <number>', '[HACKERMAN MODE] Override minimum SOL amount from .env', parseFloat)
  .option('-h, --hours <number>', '[HACKERMAN MODE] Override hours lookback from .env', parseInt)
  .option('-f, --funding <number>', '[HACKERMAN MODE] Override funding amount from .env', parseFloat)
  .option('-d, --donors <path>', '[HACKERMAN MODE] Override donors file path from .env')
  .option('-r, --recipients <path>', '[HACKERMAN MODE] Override recipients file path from .env')
  .option('--execute', '[DANGER] Execute real transactions (override DRY_RUN=true from .env)')
  .option('--create-examples', 'Create example files and exit')

async function main() {
  try {
    program.parse()
    const options = program.opts()
    
    console.log('🚀 WALLET FUNDING CLI TOOL')
    console.log('=' .repeat(60))
    console.log('')
    
    // Check if user is using CLI overrides
    const usingOverrides = Object.keys(options).length > 0 && !options.createExamples
    if (usingOverrides) {
      console.log('🤖 HACKERMAN MODE: Using CLI argument overrides')
      console.log('   💡 Tip: Configure .env file for normal operation')
      console.log('')
    }
    
    // Handle example file creation
    if (options.createExamples) {
      FileParser.createExampleFiles()
      return
    }
    
    // Load and override configuration
    const config = new Config()
    config.override(options)
    config.print()
    
    // Parse wallet files
    console.log('📄 LOADING WALLET FILES')
    console.log('=' .repeat(60))
    
    const donors = await FileParser.parseWalletFile(config.donorsFile, 'donor')
    const recipients = await FileParser.parseWalletFile(config.recipientsFile, 'recipient')
    
    console.log('')
    console.log('📊 WALLET SUMMARY:')
    console.log(`   👥 Donors loaded: ${donors.length}`)
    console.log(`   📨 Recipients loaded: ${recipients.length}`)
    console.log(`   🔑 Donors with private keys: ${donors.filter(d => d.privateKey).length}`)
    console.log('')
    
    if (donors.length === 0) {
      throw new Error('No donor wallets found')
    }
    
    if (recipients.length === 0) {
      throw new Error('No recipient wallets found')
    }
    
    // Check transaction history
    console.log('🔍 TRANSACTION ANALYSIS')
    console.log('=' .repeat(60))
    
    const checker = new TransactionChecker(config)
    const unfundedRecipients = await checker.findUnfundedRecipients(donors, recipients)
    
    // Fund unfunded wallets
    console.log('💸 WALLET FUNDING')
    console.log('=' .repeat(60))
    
    const funder = new WalletFunder(config)
    const results = await funder.fundWallets(unfundedRecipients, donors)
    
    // Final summary
    console.log('')
    console.log('🎯 FINAL SUMMARY')
    console.log('=' .repeat(60))
    console.log(`📊 Total recipients checked: ${recipients.length}`)
    console.log(`❌ Unfunded recipients found: ${unfundedRecipients.length}`)
    console.log(`✅ Funding operations successful: ${results.success}`)
    console.log(`❌ Funding operations failed: ${results.failed}`)
    console.log(`⏭️  Operations skipped: ${results.skipped}`)
    
    if (config.dryRun) {
      console.log('')
      console.log('🛡️  DRY RUN MODE: No real transactions were sent')
      console.log('💡 Use --execute flag to perform real funding operations')
    } else if (results.success > 0) {
      console.log('')
      console.log('🎉 Real funding operations completed successfully!')
    }
    
    console.log('')
    console.log('✅ Wallet funding check complete!')
    
  } catch (error) {
    console.error('')
    console.error('❌ ERROR:', error.message)
    console.error('')
    
    if (error.message.includes('file not found') || error.message.includes('File not found')) {
      console.error('💡 SOLUTION:')
      console.error('   1. Check that the file paths are correct')
      console.error('   2. Use --create-examples to generate sample files')
      console.error('   3. Use -d and -r options to specify custom file paths')
    } else if (error.message.includes('connection') || error.message.includes('RPC')) {
      console.error('💡 SOLUTION:')
      console.error('   1. Check your internet connection')
      console.error('   2. Verify SOLANA_RPC_URL in .env file')
      console.error('   3. Consider using a Helius API key for better reliability')
    }
    
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Run the CLI tool
if (require.main === module) {
  main()
}

module.exports = { main }
