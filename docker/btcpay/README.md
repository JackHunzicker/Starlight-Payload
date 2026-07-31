# Local BTCPay Server

This directory is the persistent, repository-owned Bitcoin-regtest payment stack for
Acme Commerce development. It was generated from the official BTCPay Docker project at
commit `04d6eee12cbfa0ba374a48c7f5e1ae10a06c00e1`.

The Compose project name is fixed as `btcpay-regtest`. Its containers are peers of the
application containers in Docker Desktop, but remain a separate Compose project so
BTCPay's PostgreSQL, Bitcoin node, upgrade, backup, and wallet lifecycle cannot collide
with the application stack.

## Persistent lifecycle

Run once from this directory:

```powershell
docker compose up -d
```

Every service uses `restart: unless-stopped`, so Docker Desktop restarts the stack
without pnpm, a terminal process, or an external checkout. Routine inspection and a
recoverable stop are:

```powershell
docker compose ps
docker compose stop
```

Do not use `docker compose down -v`; it deletes the local account, store, wallet,
invoices, chain, and PostgreSQL data.

BTCPay is available at <http://localhost:7779>. Only HTTP is host-published. Bitcoin RPC,
NBXplorer, PostgreSQL, and Tor remain private to the Compose network.

## Local configuration

- `.env.example` documents the required keys.
- `.env` contains the deployed regtest configuration and credentials and is ignored.
- Vendure's matching limited API key/webhook values live in the application's ignored
  `docker/.env`.
- `regtest-wallet.ps1` mines or pays an invoice from the isolated local payer wallet.

To pay an invoice shown by BTCPay:

```powershell
.\regtest-wallet.ps1 -Action Pay -Address <bcrt1-address> -Amount <exact-btc-amount>
```

The helper sends the exact regtest amount and mines one confirmation. Regtest Bitcoin has
no monetary value.

