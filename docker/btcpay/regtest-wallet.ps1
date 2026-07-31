param(
    [ValidateSet('Balance', 'Mine', 'Pay')]
    [string]$Action = 'Balance',
    [string]$Address,
    [decimal]$Amount = 0,
    [ValidateRange(1, 1000)]
    [int]$Blocks = 1
)

$ErrorActionPreference = 'Stop'
$bitcoinArgs = @(
    'exec', 'btcpayserver_bitcoind', 'bitcoin-cli',
    '-datadir=/data', '-regtest', '-rpcconnect=127.0.0.1', '-rpcport=43782'
)

function Invoke-BitcoinCli {
    param([string[]]$Arguments)

    $output = & docker @bitcoinArgs @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ($output -join [Environment]::NewLine)
    }
    return $output
}

function Ensure-PayerWallet {
    $loadedWallets = (Invoke-BitcoinCli @('listwallets') | ConvertFrom-Json)
    if ($loadedWallets -contains 'payer') { return }

    try {
        Invoke-BitcoinCli @('loadwallet', 'payer') | Out-Null
    } catch {
        Invoke-BitcoinCli @('createwallet', 'payer') | Out-Null
    }
}

Ensure-PayerWallet

switch ($Action) {
    'Balance' {
        Invoke-BitcoinCli @('-rpcwallet=payer', 'getbalance')
    }
    'Mine' {
        $miningAddress = (Invoke-BitcoinCli @('-rpcwallet=payer', 'getnewaddress')).Trim()
        Invoke-BitcoinCli @('-rpcwallet=payer', 'generatetoaddress', "$Blocks", $miningAddress) | Out-Null
        Write-Output "Mined $Blocks regtest block(s)."
    }
    'Pay' {
        if ([string]::IsNullOrWhiteSpace($Address) -or $Amount -le 0) {
            throw 'Pay requires -Address <bcrt1...> and -Amount <BTC amount> from the BTCPay invoice.'
        }

        $balance = [decimal](Invoke-BitcoinCli @('-rpcwallet=payer', 'getbalance'))
        if ($balance -lt ($Amount + [decimal]'0.001')) {
            $fundingAddress = (Invoke-BitcoinCli @('-rpcwallet=payer', 'getnewaddress')).Trim()
            Invoke-BitcoinCli @('-rpcwallet=payer', 'generatetoaddress', '101', $fundingAddress) | Out-Null
        }

        Invoke-BitcoinCli @('-rpcwallet=payer', 'settxfee', '0.00010000') | Out-Null
        $amountText = $Amount.ToString('0.00000000', [Globalization.CultureInfo]::InvariantCulture)
        $transactionId = (Invoke-BitcoinCli @('-rpcwallet=payer', 'sendtoaddress', $Address, $amountText)).Trim()
        $confirmationAddress = (Invoke-BitcoinCli @('-rpcwallet=payer', 'getnewaddress')).Trim()
        Invoke-BitcoinCli @('-rpcwallet=payer', 'generatetoaddress', '1', $confirmationAddress) | Out-Null
        Write-Output "Paid and confirmed regtest transaction $transactionId"
    }
}

