# Wallet Funding CLI Tool

A command-line tool to automatically check and fund Solana wallets based on transaction history.

## 🎯 Purpose

This tool helps you:
1. **Check** which recipient wallets haven't received transactions from donor wallets
2. **Verify** transactions meet minimum amount and timeframe requirements  
3. **Fund** unfunded wallets automatically from available donor wallets

## 🚀 Quick Start

### 1. Setup
```bash
npm install
cp .env.example .env
# Edit .env with your Helius API key and desired configuration
```

### 2. Configure .env file (MAIN METHOD)
```bash
# Get free Helius API key from https://helius.xyz
HELIUS_API_KEY=your-actual-helius-key-here

# Configure your funding logic
MIN_SOL_AMOUNT=0.1          # Check if wallets received at least 0.1 SOL
HOURS_LOOKBACK=24          # Look back 24 hours  
FUNDING_AMOUNT_SOL=0.05    # Send 0.05 SOL to unfunded wallets

# Point to your wallet files
DONORS_FILE=../public/sellers.csv
RECIPIENTS_FILE=../public/buyers.csv

# Safety first!
DRY_RUN=true              # Change to false when ready for real transactions
```

### 3. Run the tool (Simple!)
```bash
# Just run it - all settings come from .env
node index.js

# To execute real transactions, set DRY_RUN=false in .env, then:
node index.js
```

## 🤖 Hackerman Mode (Optional CLI Overrides)

**Normal usage:** Just configure `.env` and run `node index.js`

**Advanced usage:** Override any setting temporarily with CLI arguments:

| Option | Description | Example |
|--------|-------------|---------|
| `-a, --amount <number>` | Override minimum SOL amount from .env | `--amount 0.2` |
| `-h, --hours <number>` | Override hours lookback from .env | `--hours 48` |
| `-f, --funding <number>` | Override funding amount from .env | `--funding 0.1` |
| `-d, --donors <path>` | Override donors file path from .env | `--donors custom-donors.json` |
| `-r, --recipients <path>` | Override recipients file path from .env | `--recipients custom-recipients.json` |
| `--execute` | Force real transactions (override DRY_RUN=true) | `--execute` |
| `--create-examples` | Create example files | `--create-examples` |

**Hackerman Example:**
```bash
# Override settings temporarily without changing .env
node index.js --amount 0.2 --hours 48 --funding 0.1 --execute
```

## 📁 File Formats

### Donors (Need Private Keys for Funding)

**CSV Format:**
```csv
address,private_key
4TP5t1QzcfzN1QUrjmZBYKSYXXM8BE7kpw3L55cssLRP,"[234,38,18...]"
```

**JSON Format:**
```json
[
  {
    "address": "4TP5t1QzcfzN1QUrjmZBYKSYXXM8BE7kpw3L55cssLRP",
    "privateKey": "[234,38,18,35,161,131,224,6,177,223,74,148,96,166,28,123,239,211,58,104,248,14,47,19,24,128,124,153,85,208,68,28,51,85,33,230,42,223,234,142,191,180,249,42,107,115,92,29,63,26,61,255,36,211,145,92,158,116,243,32,139,161,199,2]"
  }
]
```

### Recipients (Just Public Addresses)

**CSV Format:**
```csv
address
G8CcfRffqZWHSAQJXLDfwbAkGE95SddUqVXnTrL4kqjm
9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
```

**JSON Format:**
```json
[
  "G8CcfRffqZWHSAQJXLDfwbAkGE95SddUqVXnTrL4kqjm",
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
]
```

## ⚙️ Configuration

### Environment Variables (.env)
```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
HELIUS_API_KEY=your-helius-api-key-here

# Default Parameters
MIN_SOL_AMOUNT=0.1
HOURS_LOOKBACK=24
FUNDING_AMOUNT_SOL=0.05

# File Paths
DONORS_FILE=../public/sellers.csv
RECIPIENTS_FILE=../public/buyers.csv

# Safety Settings
DRY_RUN=true
MAX_FUNDING_OPERATIONS=10
```

## 🔍 How It Works

### 1. **Parse Files**
- Loads donor and recipient wallet addresses from CSV/JSON files
- Validates wallet address formats
- Identifies which donors have private keys for funding

### 2. **Check Transaction History**
- For each recipient, fetches recent transactions (last 100)
- Filters transactions within the specified timeframe
- Analyzes each transaction to find SOL transfers from donors
- Checks if transfer amount meets minimum requirement

### 3. **Fund Unfunded Wallets**
- Identifies recipients that haven't received qualifying transactions
- Uses available donors (with private keys and sufficient balance)
- Sends SOL to unfunded recipients
- Includes safety limits and rate limiting

## 🛡️ Safety Features

- **Dry Run Mode**: Default mode shows what would happen without real transactions
- **Balance Checks**: Verifies donor wallets have sufficient balance before funding
- **Transaction Limits**: Configurable maximum funding operations per run
- **Error Handling**: Continues operation if individual transactions fail
- **Rate Limiting**: Built-in delays to avoid overwhelming the network

## 📊 Example Usage

### Scenario: Check if wallets received their daily allowance
```bash
# Check if recipients got at least 0.1 SOL from donors in last 24 hours
# If not, fund them with 0.05 SOL each
node index.js --amount 0.1 --hours 24 --funding 0.05 --execute
```

### Output:
```
🚀 WALLET FUNDING CLI TOOL
============================================================

🔧 Configuration:
   💰 Minimum SOL amount: 0.1
   ⏰ Hours lookback: 24
   💸 Funding amount: 0.05 SOL
   👥 Donors file: ../public/sellers.csv
   📨 Recipients file: ../public/buyers.csv
   🛡️  Dry run: No (REAL TRANSACTIONS)

📄 LOADING WALLET FILES
============================================================
📄 Parsing donor file: ../public/sellers.csv
   📊 CSV headers detected: address, private_key
   ✅ Loaded 5 donor wallets from CSV
   ✅ 5 valid wallet addresses loaded

📊 WALLET SUMMARY:
   👥 Donors loaded: 5
   📨 Recipients loaded: 10
   🔑 Donors with private keys: 3

🔍 TRANSACTION ANALYSIS
============================================================
🔍 Checking 10 recipients against 5 donors...
   💰 Looking for transactions >= 0.1 SOL
   ⏰ Within last 24 hours

📋 [1/10] Checking G8CcfRff...
   ✅ FUNDED: Has qualifying transactions

📋 [2/10] Checking 9WzDXwBb...
   ❌ UNFUNDED: No qualifying transactions found

📊 ANALYSIS COMPLETE:
   ✅ Funded recipients: 8
   ❌ Unfunded recipients: 2

💸 WALLET FUNDING
============================================================
   📋 Unfunded recipients: 2
   💰 Funding amount: 0.05 SOL each
   👥 Available donors: 3

💸 [1/2] Funding 9WzDXwBb... from 4TP5t1Qz...
   ✅ SUCCESS: Sent 0.05 SOL

🎯 FINAL SUMMARY
============================================================
📊 Total recipients checked: 10
❌ Unfunded recipients found: 2
✅ Funding operations successful: 2
❌ Funding operations failed: 0
```

## 🔧 Troubleshooting

### Common Issues

1. **"File not found"**
   - Check file paths in .env or use -d/-r options
   - Use `--create-examples` to generate sample files

2. **"No donors with private keys"**
   - Ensure donor files include private_key column/field
   - Verify private key format (JSON array or base58)

3. **"RPC connection failed"**
   - Check internet connection
   - Verify SOLANA_RPC_URL in .env
   - Consider using Helius API key for better reliability

4. **"Insufficient balance"**
   - Check donor wallet balances
   - Reduce funding amount or add more SOL to donor wallets

## 📈 Performance Notes

- Processes ~10 wallets per batch with rate limiting
- Uses transaction history analysis (not full blockchain scan)
- Optimized for accuracy over speed
- Memory efficient for large wallet lists

## 🔒 Security

- Private keys are handled in memory only
- No key logging or persistence
- Dry run mode enabled by default
- Configurable transaction limits for safety
