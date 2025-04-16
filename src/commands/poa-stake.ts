import Node, { Contract } from 'evm-lite-core';
import { Currency } from 'evm-lite-utils';
import Inquirer from 'inquirer';
import Vorpal from 'vorpal';
import Session from '../core/Session';
import Command, { Arguments, TxOptions } from '../core/TxCommand';

type Opts = TxOptions & {
    host: string;
    port: number;
};

type Args = Arguments<Opts> & {
    amount: string;
};

type Answers = {
    amount: string;
};

export default (evmlc: Vorpal, session: Session) => {
    const description = 'Stake BOC tokens to participate in consensus';

    return evmlc
        .command('stake [amount]')
        .alias('s')
        .description(description)
        .option('-i, --interactive', 'enter interactive')
        .option('-d, --debug', 'show debug output')
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

        this.node = new Node(this.args.options.host, this.args.options.port);

        return this.args.options.interactive;
    }

    protected async prompt(): Promise<void> {
        const questions: Inquirer.QuestionCollection<Answers> = [
            {
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
        this.args.amount = answers.amount;
    }

    protected async check(): Promise<void> {
        const amount = parseFloat(this.args.amount);
        if (isNaN(amount) || amount <= 100000) {
            throw Error('Invalid stake amount. Must stake more than 100,000 BOC');
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

        this.debug('Generating stake transaction');
        const tx = contract.methods.stake(
            {
                gas: this.args.options.gas,
                gasPrice: Number(this.args.options.gasPrice),
                value: new Currency(this.args.amount).format('a').slice(0, -1)
            }
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