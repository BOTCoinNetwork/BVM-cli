import Node, { Contract } from 'evm-lite-core';
import Datadir from 'evm-lite-datadir';
import { Currency, IUnits } from 'evm-lite-utils';
import Inquirer from 'inquirer';
import Vorpal from 'vorpal';
import color from '../core/color';
import Session from '../core/Session';
import Command, { Arguments, TxOptions } from '../core/TxCommand';

type Opts = TxOptions & {
    host: string;
    port: number;

    pwd?: string;
    from: string;
    value: string;
};

type Args = Arguments<Opts> & {
    amount: string;
};

type Answers = {
    amount: string;
};

function isLetter(str: string) {
	return str.length === 1 && str.match(/[a-z]/i);
}

export default (evmlc: Vorpal, session: Session) => {
    const description = 'Stake BOC tokens to participate in consensus';

    return evmlc
        .command('stake [amount]')
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
        const keystore = await this.datadir.listKeyfiles();
        const questions: Inquirer.QuestionCollection<Answers> = [
            {
                default:
					(this.args.options.from &&
						keystore[this.args.options.from].address) ||
					'',
                message: 'Stake amount (BOC): ',
                name: 'amount',
                type: 'input',
                validate: (input: string) => {
                    const amount = parseFloat(input);
                    return amount > 100000 || 'Must stake more than 100,000 BOC';
                }
            }
        ];

        const answers = await Inquirer.prompt<Answers>(questions);

        this.args.options.value = answers.amount;

		const u = this.args.options.value.toString().slice(-1) as IUnits;
		if (!isLetter(u)) {
			this.args.options.value = this.args.options.value + 'T';
		}
    }

    protected async check(): Promise<void> {
        
        if (!this.args.options.value) {
			throw Error('Provide `to` address and `value` to send');
		}

        if (parseFloat(this.args.options.value) <= 100000) {
            throw Error('Invalid stake amount. Must stake more than 100,000 BOC');
        }
        if (!this.account) {
			if (!this.args.options.from) {
				throw Error('No `from` moniker provided or set in config.');
			}

			if (!this.passphrase) {
				if (!this.args.options.pwd) {
					throw Error('Passphrase file path not provided.');
				}
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
                gas: this.args.options.gas,
                gasPrice: Number(this.args.options.gasPrice),
                value: new Currency(this.args.options.value)
            }
        );

        color.yellow(JSON.stringify(tx, null, 2));
        color.yellow(
            `Transaction fee: ${Number(this.args.options.gasPrice)}`
        );     

        this.debug('Sending transaction');

        const response = await this.node!.sendTx(tx, poa.address);

        if (this.args.options.json) {
            return JSON.stringify({
                txHash: response.transactionHash,
                amount: this.args.amount,
                status: response.status
            });
        } else {
            return `Successfully staked ${this.args.amount} BOC. Transaction: ${response.transactionHash}`;
        }
    }
}

export const Stake = StakeCommand;