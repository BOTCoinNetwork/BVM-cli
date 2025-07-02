import * as fs from 'fs';

import Node, { Contract } from 'evm-lite-core';
import Datadir from 'evm-lite-datadir';
import utils, { Currency, IUnits } from 'evm-lite-utils';
import Inquirer from 'inquirer';
import Vorpal from 'vorpal';
import color from '../core/color';
import Session from '../core/Session';
import Logs from '../poa/Logs';

import { Staked } from '../poa/Events';

import Command, { Arguments, TxOptions } from '../core/TxCommand';

type Opts = TxOptions & {
    interactive?: boolean;
    host: string;
    port: number;

    pwd?: string;
    from: string;
    value: string;
};

type Args = Arguments<Opts> & {
    value: string;
};

type Answers = {
    value: string;
};

function isLetter(str: string) {
	return str.length === 1 && str.match(/[a-z]/i);
}

export default (evmlc: Vorpal, session: Session) => {
    const description = 'Stake BOC tokens to participate in consensus';

    return evmlc
        .command('stake [value]')
        .alias('s')
        .description(description)
        .option('-i, --interactive', 'enter interactive')
        .option('-d, --debug', 'show debug output')
        .option('--from <moniker>', 'from moniker')
        .option('--pwd <password>', 'passphrase file path')
        .option('-g, --gas <g>', 'override config gas value')
        .option('-h, --host <ip>', 'override config host value')
        .option('-p, --port <port>', 'override config port value')
        .types({
            string: ['_', 'from', 'h', 'host']
        })
        .action(
            (args: Args): Promise<void> =>
                new StakeCommand(session, args).run()
        );
};

class StakeCommand extends Command<Args> {
    protected async init(): Promise<boolean> {
        this.payable = true;

        this.args.options.interactive =
            this.args.options.interactive || this.session.interactive;

        this.args.options.host =
            this.args.options.host || this.config.connection.host;
        this.args.options.port =
            this.args.options.port || this.config.connection.port;

        if (!this.args.options.gas && this.args.options.gas !== 0) {
            this.args.options.gas = this.config.defaults.gas;
        }
        this.args.options.from =
			this.args.options.from || this.config.defaults.from;

        this.node = new Node(this.args.options.host, this.args.options.port);

        return this.args.options.interactive;
    }

    protected async prompt(): Promise<void> {
        
        const questions: Inquirer.QuestionCollection<Answers> = [
            {
                message: 'Stake value (BOC): ',
                name: 'value',
                type: 'input',
            }
        ];

        const answers = await Inquirer.prompt<Answers>(questions);

        this.args.options.value = answers.value;

		const u = this.args.options.value.toString().slice(-1) as IUnits;
		if (!isLetter(u)) {
			this.args.options.value = this.args.options.value + 'T';
		}
    }

    protected async check(): Promise<void> {
        
        if (!this.args.options.value) {
			throw Error('Provide `to` address and `value` to send');
		}

        if (!this.account) {
			if (!this.args.options.from) {
				throw Error('No `from` moniker provided or set in config.');
			}

			if (!this.passphrase) {
				if (!this.args.options.pwd) {
					throw Error('--pwd file path not provided.');
				}

				if (!utils.exists(this.args.options.pwd)) {
					throw Error('--pwd file path provided does not exist.');
				}

				if (utils.isDirectory(this.args.options.pwd)) {
					throw Error('--pwd file path provided is a directory.');
				}

				this.passphrase = fs
					.readFileSync(this.args.options.pwd, 'utf8')
					.trim();
			}
		}
    }

    protected async exec(): Promise<string> {
        this.log.http(
			'GET',
			`${this.args.options.host}:${this.args.options.port}/poa`
		);

		const poa = await this.node!.getPOA();

		this.log.info('POA', poa.address);

		const contract = Contract.load(JSON.parse(poa.abi), poa.address);

        // sanity check
        if (!this.account) {
            const keyfile = await this.datadir.getKeyfile(
                this.args.options.from
            );

            this.account = Datadir.decrypt(keyfile, this.passphrase!);
        }

        this.debug('Generating stake transaction'); 
        const tx = contract.methods.stake(
            {
                from: this.account.address,
                gas:  this.args.options.gas,
                gasPrice: Number(this.args.options.gasPrice),
                value: new Currency(this.args.options.value).format('a').slice(0, -1)
            }
        );

        color.yellow(JSON.stringify(tx, null, 2));    

        this.debug('Sending transaction');

        const receipt: any = await this.node!.sendTx(tx, this.account);

        if (!receipt.logs.length) {
			this.debug('Not stake - Gas or not stake');
		}

		this.debug('Parsing logs from receipt');
		const logs = new Logs(receipt.logs);
        const evs = logs.filter<Staked>('Staked');

        color.yellow(JSON.stringify(logs, null, 2));

        let evStaked: Staked | undefined;
        const from_addr = this.account?.address
        if (!evs.length) {
			throw Error('Staked Fail, `Must stake >= 210,000 BOC Or Must be whole tokens without decimals');
		} else {
			evStaked = evs.find(
				e =>
					utils.hexToString(e.staker.toLowerCase().trim()) ===
					utils.hexToString(from_addr.toLowerCase().trim())
			);
		}

		if (!evStaked) {
			throw Error(
				'Could not find corresponding `evStaked` event'
			);
		}


        if (this.args.options.json) { 
            return JSON.stringify({
                txHash: receipt.transactionHash,
                value: this.args.value,
                status: receipt.status
            });
        } else {
            const amout = (Number(evStaked.amount) / 1e18).toFixed(4)
            return `Successfully staked ${amout} BOC. Transaction: ${receipt.transactionHash}`;
        }
    }
}

export const Stake = StakeCommand;