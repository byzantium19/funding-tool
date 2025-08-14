const fs = require('fs')
const csv = require('csv-parser')
const { PublicKey, Keypair } = require('@solana/web3.js')

class FileParser {
  
  /**
   * Parse CSV file and extract wallet addresses
   * Supports both JSON arrays and CSV format
   * Donors need private keys, recipients only need addresses
   */
  static async parseWalletFile(filePath, expectedType = 'unknown') {
    console.log(`📄 Parsing ${expectedType} file: ${filePath}`)
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }
    
    // Check if it's a JSON file
    if (filePath.endsWith('.json')) {
      return await this.parseJsonFile(filePath, expectedType)
    }
    
    // Otherwise treat as CSV
    return await this.parseCsvFile(filePath, expectedType)
  }
  
  /**
   * Parse JSON file containing array of wallet addresses
   */
  static async parseJsonFile(filePath, expectedType) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const data = JSON.parse(content)
      
      if (!Array.isArray(data)) {
        throw new Error('JSON file must contain an array of wallet addresses')
      }
      
      const wallets = data.map(item => {
        if (typeof item === 'string') {
          return { address: item, privateKey: null }
        } else if (typeof item === 'object' && item.address) {
          return {
            address: item.address,
            privateKey: item.privateKey || null
          }
        } else {
          throw new Error('Invalid wallet format in JSON file')
        }
      })
      
      console.log(`   ✅ Loaded ${wallets.length} ${expectedType} wallets from JSON`)
      return this.validateWallets(wallets)
      
    } catch (error) {
      throw new Error(`Failed to parse JSON file ${filePath}: ${error.message}`)
    }
  }
  
  /**
   * Parse CSV file - auto-detect format based on headers
   */
  static async parseCsvFile(filePath, expectedType) {
    return new Promise((resolve, reject) => {
      const wallets = []
      let headers = []
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
          headers = headerList
          console.log(`   📊 CSV headers detected: ${headers.join(', ')}`)
        })
        .on('data', (row) => {
          try {
            const wallet = this.extractWalletFromRow(row, headers, expectedType)
            if (wallet) {
              wallets.push(wallet)
            }
          } catch (error) {
            console.warn(`   ⚠️  Skipping invalid row: ${error.message}`)
          }
        })
        .on('end', () => {
          console.log(`   ✅ Loaded ${wallets.length} ${expectedType} wallets from CSV`)
          try {
            const validatedWallets = this.validateWallets(wallets)
            resolve(validatedWallets)
          } catch (error) {
            reject(error)
          }
        })
        .on('error', (error) => {
          reject(new Error(`Failed to parse CSV file ${filePath}: ${error.message}`))
        })
    })
  }
  
  /**
   * Extract wallet info from CSV row based on common column patterns
   * Handles both donors (need private keys) and recipients (just addresses)
   */
  static extractWalletFromRow(row, headers, expectedType = 'unknown') {
    // Common patterns for wallet address columns
    const addressColumns = [
      'address', 'wallet', 'wallet_address', 'public_key', 'publicKey',
      'walletAddress', 'Address', 'Wallet', 'PublicKey'
    ]
    
    // Common patterns for private key columns  
    const privateKeyColumns = [
      'private_key', 'privateKey', 'secret', 'secretKey', 'secret_key',
      'key', 'PrivateKey', 'Private_Key'
    ]
    
    let address = null
    let privateKey = null
    
    // Find address column first
    for (const col of addressColumns) {
      if (row[col] && row[col].trim()) {
        address = row[col].trim()
        break
      }
    }
    
    // Find private key column
    for (const col of privateKeyColumns) {
      if (row[col] && row[col].trim()) {
        privateKey = row[col].trim()
        break
      }
    }
    
    // If no address found but we have a private key, derive the address
    if (!address && privateKey) {
      try {
        address = this.deriveAddressFromPrivateKey(privateKey)
      } catch (error) {
        throw new Error(`Failed to derive address from private key: ${error.message}`)
      }
    }
    
    // If no specific columns found, try first column
    if (!address && !privateKey && headers.length > 0) {
      const firstCol = headers[0]
      if (row[firstCol] && row[firstCol].trim()) {
        const value = row[firstCol].trim()
        
        // Check if it looks like a private key (starts with [ or is very long)
        if (value.startsWith('[') || (value.length > 60 && !value.includes(' '))) {
          privateKey = value
          try {
            address = this.deriveAddressFromPrivateKey(privateKey)
          } catch (error) {
            throw new Error(`Failed to derive address from private key: ${error.message}`)
          }
        } else {
          // Assume it's a public address
          address = value
        }
      }
    }
    
    if (!address) {
      throw new Error('No wallet address or private key found in row')
    }
    
    // For recipients, we don't need private keys - just warn if missing for donors
    if (expectedType === 'donor' && !privateKey) {
      console.log(`   ⚠️  Donor ${address.slice(0, 8)}... has no private key (cannot fund from this wallet)`)
    }
    
    return { address, privateKey }
  }
  
  /**
   * Validate wallet addresses and filter out invalid ones
   */
  static validateWallets(wallets) {
    const validWallets = []
    const invalidCount = wallets.length
    
    for (const wallet of wallets) {
      try {
        // Validate the public key format
        new PublicKey(wallet.address)
        validWallets.push(wallet)
      } catch (error) {
        console.warn(`   ⚠️  Invalid wallet address: ${wallet.address}`)
      }
    }
    
    const validCount = validWallets.length
    const skippedCount = invalidCount - validCount
    
    if (skippedCount > 0) {
      console.log(`   ⚠️  Skipped ${skippedCount} invalid wallet addresses`)
    }
    
    if (validCount === 0) {
      throw new Error('No valid wallet addresses found in file')
    }
    
    console.log(`   ✅ ${validCount} valid wallet addresses loaded`)
    return validWallets
  }
  
  /**
   * Create example JSON files for testing
   */
  static createExampleFiles() {
    // Donors need private keys for funding
    const donorsExample = [
      {
        "address": "4TP5t1QzcfzN1QUrjmZBYKSYXXM8BE7kpw3L55cssLRP",
        "privateKey": "[234,38,18,35,161,131,224,6,177,223,74,148,96,166,28,123,239,211,58,104,248,14,47,19,24,128,124,153,85,208,68,28,51,85,33,230,42,223,234,142,191,180,249,42,107,115,92,29,63,26,61,255,36,211,145,92,158,116,243,32,139,161,199,2]"
      }
    ]
    
    // Recipients only need public addresses
    const recipientsExample = [
      "G8CcfRffqZWHSAQJXLDfwbAkGE95SddUqVXnTrL4kqjm",
      "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      "BM3FZBua5XEhkjkebGjE8xMx8R5YhCrUrPiKfzBPRt6v"
    ]
    
    // Also create simplified CSV examples
    const donorsCsv = `address,private_key
4TP5t1QzcfzN1QUrjmZBYKSYXXM8BE7kpw3L55cssLRP,"[234,38,18,35,161,131,224,6,177,223,74,148,96,166,28,123,239,211,58,104,248,14,47,19,24,128,124,153,85,208,68,28,51,85,33,230,42,223,234,142,191,180,249,42,107,115,92,29,63,26,61,255,36,211,145,92,158,116,243,32,139,161,199,2]"`
    
    const recipientsCsv = `address
G8CcfRffqZWHSAQJXLDfwbAkGE95SddUqVXnTrL4kqjm
9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
BM3FZBua5XEhkjkebGjE8xMx8R5YhCrUrPiKfzBPRt6v`
    
    fs.writeFileSync('donors-example.json', JSON.stringify(donorsExample, null, 2))
    fs.writeFileSync('recipients-example.json', JSON.stringify(recipientsExample, null, 2))
    fs.writeFileSync('donors-example.csv', donorsCsv)
    fs.writeFileSync('recipients-example.csv', recipientsCsv)
    
    console.log('✅ Created example files:')
    console.log('   📄 donors-example.json & donors-example.csv (with private keys)')
    console.log('   📄 recipients-example.json & recipients-example.csv (addresses only)')
  }
  
  /**
   * Derive public key address from private key
   */
  static deriveAddressFromPrivateKey(privateKeyString) {
    try {
      // Parse private key and create keypair
      let keypair
      
      if (privateKeyString.startsWith('[') && privateKeyString.endsWith(']')) {
        // JSON array format
        const keyArray = JSON.parse(privateKeyString)
        keypair = Keypair.fromSecretKey(new Uint8Array(keyArray))
      } else {
        // Try base58 format
        const bs58 = require('bs58')
        const secretKey = bs58.decode(privateKeyString)
        keypair = Keypair.fromSecretKey(secretKey)
      }
      
      return keypair.publicKey.toString()
      
    } catch (error) {
      throw new Error(`Invalid private key format: ${error.message}`)
    }
  }
}

module.exports = FileParser
