const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} = require('@solana/web3.js')

class WalletFunder {
  constructor(config) {
    this.config = config
    this.connection = new Connection(config.getRpcUrl(), 'confirmed')
  }
  
  /**
   * Fund unfunded wallets from available donors
   */
  async fundWallets(unfundedRecipients, donors) {
    if (unfundedRecipients.length === 0) {
      console.log('🎉 All recipients are already funded! No action needed.')
      return { success: 0, failed: 0, skipped: 0 }
    }
    
    console.log(`💸 FUNDING PHASE`)
    console.log(`   📋 Unfunded recipients: ${unfundedRecipients.length}`)
    console.log(`   💰 Funding amount: ${this.config.fundingAmountSol} SOL each`)
    console.log(`   🛡️  Dry run: ${this.config.dryRun ? 'Yes (no real transactions)' : 'No (REAL TRANSACTIONS)'}`)
    console.log(`   📊 Max operations: ${this.config.maxFundingOperations}`)
    console.log('')
    
    // Limit funding operations
    const recipientsToFund = unfundedRecipients.slice(0, this.config.maxFundingOperations)
    
    if (recipientsToFund.length < unfundedRecipients.length) {
      console.log(`⚠️  Limited to first ${this.config.maxFundingOperations} recipients for safety`)
    }
    
    // Find donors with private keys and sufficient balance
    const availableDonors = await this.getAvailableDonors(donors)
    
    if (availableDonors.length === 0) {
      console.log('❌ No donors with private keys and sufficient balance found!')
      return { success: 0, failed: 0, skipped: recipientsToFund.length }
    }
    
    console.log(`👥 Available donors: ${availableDonors.length}`)
    console.log('')
    
    // Fund recipients
    const results = { success: 0, failed: 0, skipped: 0 }
    let donorIndex = 0
    
    for (let i = 0; i < recipientsToFund.length; i++) {
      const recipient = recipientsToFund[i]
      const donor = availableDonors[donorIndex % availableDonors.length]
      
      console.log(`💸 [${i + 1}/${recipientsToFund.length}] Funding ${recipient.address.slice(0, 8)}... from ${donor.address.slice(0, 8)}...`)
      
      try {
        if (this.config.dryRun) {
          console.log(`   🔍 DRY RUN: Would send ${this.config.fundingAmountSol} SOL`)
          results.success++
        } else {
          await this.sendSol(donor, recipient.address, this.config.fundingAmountSol)
          console.log(`   ✅ SUCCESS: Sent ${this.config.fundingAmountSol} SOL`)
          results.success++
        }
        
      } catch (error) {
        console.log(`   ❌ FAILED: ${error.message}`)
        results.failed++
      }
      
      donorIndex++
      
      // Rate limiting delay
      if (!this.config.dryRun && (i + 1) % 5 === 0) {
        console.log(`   ⏳ Brief pause to avoid overwhelming the network...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    console.log('')
    console.log('📊 FUNDING RESULTS:')
    console.log(`   ✅ Successful: ${results.success}`)
    console.log(`   ❌ Failed: ${results.failed}`)
    console.log(`   ⏭️  Skipped: ${results.skipped}`)
    
    return results
  }
  
  /**
   * Get donors that have private keys and sufficient balance
   */
  async getAvailableDonors(donors) {
    console.log('🔍 Checking donor availability...')
    const availableDonors = []
    const requiredBalance = this.config.fundingAmountSol + 0.001 // Add some for fees
    
    for (const donor of donors) {
      if (!donor.privateKey) {
        console.log(`   ⚠️  ${donor.address.slice(0, 8)}... - No private key`)
        continue
      }
      
      try {
        const balance = await this.getWalletBalance(donor.address)
        
        if (balance >= requiredBalance) {
          availableDonors.push({
            ...donor,
            balance: balance,
            keypair: this.parsePrivateKey(donor.privateKey)
          })
          console.log(`   ✅ ${donor.address.slice(0, 8)}... - ${balance.toFixed(6)} SOL (available)`)
        } else {
          console.log(`   ⚠️  ${donor.address.slice(0, 8)}... - ${balance.toFixed(6)} SOL (insufficient)`)
        }
        
      } catch (error) {
        console.log(`   ❌ ${donor.address.slice(0, 8)}... - Error: ${error.message}`)
      }
    }
    
    return availableDonors
  }
  
  /**
   * Send SOL from donor to recipient
   */
  async sendSol(donor, recipientAddress, amount) {
    const fromKeypair = donor.keypair
    const toPublicKey = new PublicKey(recipientAddress)
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL)
    
    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: lamports
      })
    )
    
    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = fromKeypair.publicKey
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [fromKeypair],
      { commitment: 'confirmed', preflightCommitment: 'confirmed' }
    )
    
    return signature
  }
  
  /**
   * Parse private key from various formats
   */
  parsePrivateKey(privateKeyString) {
    try {
      // Try parsing as JSON array first
      if (privateKeyString.startsWith('[') && privateKeyString.endsWith(']')) {
        const keyArray = JSON.parse(privateKeyString)
        return Keypair.fromSecretKey(new Uint8Array(keyArray))
      }
      
      // Try as base58 string
      const bs58 = require('bs58')
      const secretKey = bs58.decode(privateKeyString)
      return Keypair.fromSecretKey(secretKey)
      
    } catch (error) {
      throw new Error(`Invalid private key format: ${error.message}`)
    }
  }
  
  /**
   * Get SOL balance for a wallet
   */
  async getWalletBalance(address) {
    try {
      const publicKey = new PublicKey(address)
      const balance = await this.connection.getBalance(publicKey)
      return balance / LAMPORTS_PER_SOL
    } catch (error) {
      throw new Error(`Failed to get balance for ${address}: ${error.message}`)
    }
  }
}

module.exports = WalletFunder
