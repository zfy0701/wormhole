from time import time, sleep
from typing import List, Tuple, Dict, Any, Optional, Union
from base64 import b64decode
import base64
import sys
import random
import hashlib
import argparse

from algosdk.v2client.algod import AlgodClient
from algosdk.kmd import KMDClient
from algosdk import account, mnemonic
from algosdk.future import transaction
from algosdk.encoding import decode_address
from pyteal import compileTeal, Mode, Expr
from pyteal import *
from algosdk.logic import get_application_address

import pprint

class Account:
    """Represents a private key and address for an Algorand account"""

    def __init__(self, privateKey: str) -> None:
        self.sk = privateKey
        self.addr = account.address_from_private_key(privateKey)
#        print (privateKey + " -> " + self.getMnemonic())

    def getAddress(self) -> str:
        return self.addr

    def getPrivateKey(self) -> str:
        return self.sk

    def getMnemonic(self) -> str:
        return mnemonic.from_private_key(self.sk)

    @classmethod
    def FromMnemonic(cls, m: str) -> "Account":
        return cls(mnemonic.to_private_key(m))

class PendingTxnResponse:
    def __init__(self, response: Dict[str, Any]) -> None:
        self.poolError: str = response["pool-error"]
        self.txn: Dict[str, Any] = response["txn"]

        self.applicationIndex: Optional[int] = response.get("application-index")
        self.assetIndex: Optional[int] = response.get("asset-index")
        self.closeRewards: Optional[int] = response.get("close-rewards")
        self.closingAmount: Optional[int] = response.get("closing-amount")
        self.confirmedRound: Optional[int] = response.get("confirmed-round")
        self.globalStateDelta: Optional[Any] = response.get("global-state-delta")
        self.localStateDelta: Optional[Any] = response.get("local-state-delta")
        self.receiverRewards: Optional[int] = response.get("receiver-rewards")
        self.senderRewards: Optional[int] = response.get("sender-rewards")

        self.innerTxns: List[Any] = response.get("inner-txns", [])
        self.logs: List[bytes] = [b64decode(l) for l in response.get("logs", [])]

class Setup:
    def __init__(self, args) -> None:
        self.args = args
        self.ALGOD_ADDRESS = args.algod_address
        self.ALGOD_TOKEN = args.algod_token
        self.FUNDING_AMOUNT = 100_000_000

        self.KMD_ADDRESS = args.kmd_address
        self.KMD_TOKEN = args.kmd_token
        self.KMD_WALLET_NAME = args.kmd_name
        self.KMD_WALLET_PASSWORD = args.kmd_password

        self.TARGET_ACCOUNT = args.mnemonic

        self.kmdAccounts : Optional[List[Account]] = None

        self.accountList : List[Account] = []

        self.APPROVAL_PROGRAM = b""
        self.CLEAR_STATE_PROGRAM = b""

    def waitForTransaction(
            self, client: AlgodClient, txID: str, timeout: int = 10
    ) -> PendingTxnResponse:
        lastStatus = client.status()
        lastRound = lastStatus["last-round"]
        startRound = lastRound
    
        while lastRound < startRound + timeout:
            pending_txn = client.pending_transaction_info(txID)
    
            if pending_txn.get("confirmed-round", 0) > 0:
                return PendingTxnResponse(pending_txn)
    
            if pending_txn["pool-error"]:
                raise Exception("Pool error: {}".format(pending_txn["pool-error"]))
    
            lastStatus = client.status_after_block(lastRound + 1)
    
            lastRound += 1
    
        raise Exception(
            "Transaction {} not confirmed after {} rounds".format(txID, timeout)
        )

    def getKmdClient(self) -> KMDClient:
        return KMDClient(self.KMD_TOKEN, self.KMD_ADDRESS)
    
    def getGenesisAccounts(self) -> List[Account]:
        if self.kmdAccounts is None:
            kmd = self.getKmdClient()
    
            wallets = kmd.list_wallets()
            walletID = None
            for wallet in wallets:
                if wallet["name"] == self.KMD_WALLET_NAME:
                    walletID = wallet["id"]
                    break
    
            if walletID is None:
                raise Exception("Wallet not found: {}".format(self.KMD_WALLET_NAME))
    
            walletHandle = kmd.init_wallet_handle(walletID, self.KMD_WALLET_PASSWORD)
    
            try:
                addresses = kmd.list_keys(walletHandle)
                privateKeys = [
                    kmd.export_key(walletHandle, self.KMD_WALLET_PASSWORD, addr)
                    for addr in addresses
                ]
                self.kmdAccounts = [Account(sk) for sk in privateKeys]
            finally:
                kmd.release_wallet_handle(walletHandle)
    
        return self.kmdAccounts
    
    def getTargetAccount(self) -> Account:
        return Account.FromMnemonic(self.TARGET_ACCOUNT)

    def fundTargetAccount(self, client: AlgodClient, target: Account):
        print("fundTargetAccount")
        genesisAccounts = self.getGenesisAccounts()
        suggestedParams = client.suggested_params()
    
        for fundingAccount in genesisAccounts:
            txn = transaction.PaymentTxn(
                    sender=fundingAccount.getAddress(),
                    receiver=target.getAddress(),
                    amt=self.FUNDING_AMOUNT,
                    sp=suggestedParams,
                )
            pprint.pprint(txn)
            print("signing txn")
            stxn = txn.sign(fundingAccount.getPrivateKey())
            print("sending txn")
            client.send_transaction(stxn)
            print("waiting for txn")
            self.waitForTransaction(client, stxn.get_txid())

    def getAlgodClient(self) -> AlgodClient:
        return AlgodClient(self.ALGOD_TOKEN, self.ALGOD_ADDRESS)

    def getBalances(self, client: AlgodClient, account: str) -> Dict[int, int]:
        balances: Dict[int, int] = dict()
    
        accountInfo = client.account_info(account)
    
        # set key 0 to Algo balance
        balances[0] = accountInfo["amount"]
    
        assets: List[Dict[str, Any]] = accountInfo.get("assets", [])
        for assetHolding in assets:
            assetID = assetHolding["asset-id"]
            amount = assetHolding["amount"]
            balances[assetID] = amount
    
        return balances

    def setup(self):
        self.client = self.getAlgodClient()

        self.target = self.getTargetAccount()
        
        b = self.getBalances(self.client, self.target.getAddress())
        if (b[0] < 100000000):
            print("Account needs money... funding it")
            self.fundTargetAccount(self.client, self.target)
        #print(self.getBalances(self.client, self.target.getAddress()))

    def devnet_deploy(self):
        vaa_processor_approval = self.client.compile(open(args.teal_dir + "/" + args.approval, "r").read())
        vaa_processor_clear = self.client.compile(open(args.teal_dir + "/" + args.clear, "r").read())
        vaa_verify = self.client.compile(open(args.teal_dir + "/" + args.verify, "r").read())
        verify_hash = vaa_verify['hash']
        print("verify_hash " + verify_hash + " " + str(len(decode_address(verify_hash))))

        globalSchema = transaction.StateSchema(num_uints=4, num_byte_slices=20)
        localSchema = transaction.StateSchema(num_uints=0, num_byte_slices=0)
    
        app_args = [ "beFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe", 86400, 0 ]

        if args.appid == None:
            txn = transaction.ApplicationCreateTxn(
                sender=self.target.getAddress(),
                on_complete=transaction.OnComplete.NoOpOC,
                approval_program=b64decode(vaa_processor_approval["result"]),
                clear_program=b64decode(vaa_processor_clear["result"]),
                global_schema=globalSchema,
                local_schema=localSchema,
                app_args=app_args,
                sp=self.client.suggested_params(),
            )
        else:
            txn = transaction.ApplicationUpdateTxn(
                sender=self.target.getAddress(),
                index=args.appid,
                approval_program=b64decode(vaa_processor_approval["result"]),
                clear_program=b64decode(vaa_processor_clear["result"]),
                app_args=app_args,
                sp=self.client.suggested_params(),
            )
    
        signedTxn = txn.sign(self.target.getPrivateKey())
        self.client.send_transaction(signedTxn)
        response = self.waitForTransaction(self.client, signedTxn.get_txid())
        
        if args.appid == None:
            assert response.applicationIndex is not None and response.applicationIndex > 0
        else:
            response.applicationIndex = args.appid
            pprint.pprint(response.__dict__)
        print("app_id: ", response.applicationIndex)
        appAddr = get_application_address(response.applicationIndex)
        suggestedParams = self.client.suggested_params()
        appCallTxn = transaction.ApplicationCallTxn(
            sender=self.target.getAddress(),
            index=response.applicationIndex,
            on_complete=transaction.OnComplete.NoOpOC,
            app_args=[b"setvphash", decode_address(verify_hash)],
            sp=suggestedParams,
        )

        signedAppCallTxn = appCallTxn.sign(self.target.getPrivateKey())
        self.client.send_transactions([signedAppCallTxn])
        response = self.waitForTransaction(self.client, appCallTxn.get_txid())
        print("set the vp hash to the stateless contract")

        appCallTxn = transaction.PaymentTxn(
            sender=self.target.getAddress(),
            receiver=verify_hash,
            amt=500000,
            sp=suggestedParams,
        )
        signedAppCallTxn = appCallTxn.sign(self.target.getPrivateKey())
        self.client.send_transactions([signedAppCallTxn])
        response = self.waitForTransaction(self.client, appCallTxn.get_txid())
        print("funded the stateless contract")

    # helper function that formats global state for printing
    def format_state(self, state):
        formatted = {}
        for item in state:
            key = item['key']
            value = item['value']
            formatted_key = base64.b64decode(key).decode('utf-8')
            if value['type'] == 1:
                # byte string
                if formatted_key == 'voted':
                    formatted_value = base64.b64decode(value['bytes']).decode('utf-8')
                else:
                    formatted_value = value['bytes']
                formatted[formatted_key] = formatted_value
            else:
                # integer
                formatted[formatted_key] = value['uint']
        return formatted
    
    # helper function to read app global state
    def read_global_state(self, client, addr, app_id):
        results = client.account_info(addr)
        apps_created = results['created-apps']
        for app in apps_created:
            if app['id'] == app_id:
                return self.format_state(app['params']['global-state'])
        return {}

    def printState(self, args):
        pprint.pprint(self.read_global_state(self.client, self.target.getAddress(), args.appid))

    def test(self, args):
        appAddr = get_application_address(args.appid)
        suggestedParams = self.client.suggested_params()
        appCallTxn = transaction.ApplicationCallTxn(
            sender=self.target.getAddress(),
            index=args.appid,
            on_complete=transaction.OnComplete.NoOpOC,
            app_args=[b"governanceChainId"],
            sp=suggestedParams,
        )

        signedAppCallTxn = appCallTxn.sign(self.target.getPrivateKey())
        self.client.send_transactions([signedAppCallTxn])
        response = self.waitForTransaction(self.client, appCallTxn.get_txid())
        pprint.pprint(response.__dict__)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='algorand setup')

    parser.add_argument('--algod_address', type=str, help='algod address (default: http://localhost:4001)', 
                        default="http://localhost:4001")
    parser.add_argument('--algod_token', type=str, help='algod access token', 
                        default="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    parser.add_argument('--kmd_address', type=str, help='kmd wallet address (default: http://localhost:4002)',
                        default="http://localhost:4002")
    parser.add_argument('--kmd_token', type=str, help='kmd wallet access token', 
                        default="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    parser.add_argument('--kmd_name', type=str, help='kmd wallet name', 
                        default="unencrypted-default-wallet")
    parser.add_argument('--kmd_password', type=str, help='kmd wallet password', default="")

    parser.add_argument('--approval', type=str, help='vaa approval teal', default="vaa-processor-approval.teal")
    parser.add_argument('--clear', type=str, help='vaa clear teal', default="vaa-processor-clear.teal")
    parser.add_argument('--verify', type=str, help='vaa verify teal', default="vaa-verify.teal")
    parser.add_argument('--teal_dir', type=str, help='where to find the teal files', default=".")

    # This is the devnet mnemonic...
    parser.add_argument('--mnemonic', type=str, help='account mnemonic', 
                        default="assault approve result rare float sugar power float soul kind galaxy edit unusual pretty tone tilt net range pelican avoid unhappy amused recycle abstract master")

    parser.add_argument('--appid', type=int, help='setup devnet')
    parser.add_argument('--devnet', action='store_true', help='setup devnet')
    parser.add_argument('--test', action='store_true', help='test devnet')
    parser.add_argument('--print', action='store_true', help='print')

    args = parser.parse_args()

    if args.devnet:
        s = Setup(args)
        s.setup()
        s.devnet_deploy()
        sys.exit(0)

    if args.test:
        if args.appid == None:
            print("you need to specify the appid when testing")
            sys.exit(-1)
        s = Setup(args)
        s.setup()
        s.test(args)
        sys.exit(0)

    if args.print:
        if args.appid == None:
            print("you need to specify the appid when testing")
            sys.exit(-1)
        s = Setup(args)
        s.setup()
        s.printState(args)
        sys.exit(0)

    print("use --help to see what you can do")
    sys.exit(-1)
