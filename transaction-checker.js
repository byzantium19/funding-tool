const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js')

class TransactionChecker {
  constructor(config) {
    this.config = config
    this.connection = new Connection(config.getRpcUrl(), 'confirmed')
    
    console.log(`🌐 Connected to Solana RPC: ${config.getRpcUrl().replace(config.heliusApiKey || '', 'KEY_HIDDEN')}`)
  }
  
  /**
   * Check which recipients haven't received the required amount from donors in the timeframe
   */
  async findUnfundedRecipients(donors, recipients) {
    console.log(`🔍 Checking ${recipients.length} recipients against ${donors.length} donors...`)
    console.log(`   💰 Looking for transactions >= ${this.config.minSolAmount} SOL`)
    console.log(`   ⏰ Within last ${this.config.hoursLookback} hours`)
    console.log('')
    
    const cutoffTime = this.config.getTimeframeCutoff()
    const unfundedRecipients = []
    const donorAddresses = donors.map(d => d.address)
    
    let checkedCount = 0
    
    for (const recipient of recipients) {
      checkedCount++
      console.log(`📋 [${checkedCount}/${recipients.length}] Checking ${recipient.address.slice(0, 8)}...`)
      
      try {
        const hasFunding = await this.checkRecipientFunding(
          recipient.address, 
          donorAddresses, 
          cutoffTime
        )
        
        if (!hasFunding) {
          unfundedRecipients.push(recipient)
          console.log(`   ❌ UNFUNDED: No qualifying transactions found`)
        } else {
          console.log(`   ✅ FUNDED: Has qualifying transactions`)
        }
        
      } catch (error) {
        console.log(`   ⚠️  ERROR: ${error.message}`)
        // Add to unfunded list if we can't check (safer to fund than miss)
        unfundedRecipients.push(recipient)
      }
      
      // Rate limiting delay
      if (checkedCount % 10 === 0) {
        console.log(`   ⏳ Brief pause to avoid rate limiting...`)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log('')
    console.log('📊 ANALYSIS COMPLETE:')
    console.log(`   ✅ Funded recipients: ${recipients.length - unfundedRecipients.length}`)
    console.log(`   ❌ Unfunded recipients: ${unfundedRecipients.length}`)
    console.log('')
    
    return unfundedRecipients
  }
  
  /**
   * Check if a recipient has received funding from any donor within timeframe
   */
  async checkRecipientFunding(recipientAddress, donorAddresses, cutoffTime) {
    try {
      const publicKey = new PublicKey(recipientAddress)
      
      // Get recent transactions for the recipient
      const signatures = await this.connection.getSignaturesForAddress(
        publicKey,
        { limit: 100 } // Check last 100 transactions
      )
      
      // Filter transactions within timeframe
      const recentSignatures = signatures.filter(sig => {
        const txTime = new Date(sig.blockTime * 1000)
        return txTime >= cutoffTime
      })
      
      if (recentSignatures.length === 0) {
        return false // No recent transactions
      }
      
      // Check each recent transaction for funding from donors
      for (const sig of recentSignatures) {
        try {
          const transaction = await this.connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          })
          
          if (!transaction) continue
          
          const hasFunding = this.analyzeTransactionForFunding(
            transaction,
            recipientAddress,
            donorAddresses
          )
          
          if (hasFunding) {
            return true
          }
          
        } catch (error) {
          // Skip problematic transactions
          continue
        }
      }
      
      return false
      
    } catch (error) {
      throw new Error(`Failed to check funding for ${recipientAddress}: ${error.message}`)
    }
  }
  
  /**
   * Analyze a single transaction to see if it contains funding from donors
   */
  analyzeTransactionForFunding(transaction, recipientAddress, donorAddresses) {
    if (!transaction.meta || transaction.meta.err) {
      return false // Failed transaction
    }
    
    const preBalances = transaction.meta.preBalances
    const postBalances = transaction.meta.postBalances
    const accountKeys = transaction.transaction.message.accountKeys || 
                       transaction.transaction.message.staticAccountKeys
    
    if (!accountKeys || preBalances.length !== postBalances.length) {
      return false
    }
    
    // Find recipient account index
    let recipientIndex = -1
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys[i].toString() === recipientAddress) {
        recipientIndex = i
        break
      }
    }
    
    if (recipientIndex === -1) {
      return false // Recipient not found in transaction
    }
    
    // Check if recipient received SOL
    const balanceChange = postBalances[recipientIndex] - preBalances[recipientIndex]
    
    if (balanceChange <= 0) {
      return false // No SOL received
    }
    
    const solReceived = balanceChange / LAMPORTS_PER_SOL
    
    if (solReceived < this.config.minSolAmount) {
      return false // Amount too small
    }
    
    // Check if any sender is a donor
    for (let i = 0; i < accountKeys.length; i++) {
      const accountAddress = accountKeys[i].toString()
      
      if (donorAddresses.includes(accountAddress)) {
        const senderBalanceChange = postBalances[i] - preBalances[i]
        
        if (senderBalanceChange < 0) {
          // This donor sent SOL and recipient received enough
          console.log(`     💰 Found funding: ${solReceived.toFixed(6)} SOL from ${accountAddress.slice(0, 8)}...`)
          return true
        }
      }
    }
    
    return false
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

module.exports = TransactionChecker
