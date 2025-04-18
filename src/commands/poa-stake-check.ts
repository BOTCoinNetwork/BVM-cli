import Node, { Contract } from 'evm-lite-core';
import utils, { Currency } from 'evm-lite-utils';
import Inquirer from 'inquirer';
import Vorpal from 'vorpal';
import Session from '../core/Session';
import Command, { Arguments, TxOptions } from '../core/TxCommand';

type Opts = TxOptions & {
    host: string;
    port: number;
    gas: number;
};

type Args = Arguments<Opts> & {
    address: string;
};

type Answers = {
    address: string;
};

export default (evmlc: Vorpal, session: Session) => {
    // Command to check stake amount for a specific address
    const description = 'Query stake amount for a specific address';

    return evmlc
        .command('stake check [address]')
        .alias('s c')
        .description(description)
        .option('-i, --interactive', 'enter interactive mode')
        .option('-d, --debug', 'show debug output')
        .option('-h, --host <ip>', 'override default host')
        .option('-p, --port <port>', 'override default port')
        .option('--gas <g>', 'override default gas value')
        .types({
            string: ['_', 'address', 'h', 'host']
        })
        .action(
            (args: Args): Promise<void> =>
                new StakeCheckCommand(session, args).run()
        );
};

class StakeCheckCommand extends Command<Args> {
    protected async init(): Promise<boolean> {
        // Read-only operation
        this.constant = true;

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
                message: 'Enter address to check stake: ',
                name: 'address',
                type: 'input'
            }
        ];

        const answers = await Inquirer.prompt<Answers>(questions);
        this.args.address = answers.address;
    }

    protected async check(): Promise<void> {
        // Validate address format
        if (utils.trimHex(this.args.address).length !== 40) {
            throw Error('Invalid address format');
        }
    }

    protected async exec(): Promise<string> {
        this.log.http(
            'GET',
            `${this.args.options.host}:${this.args.options.port}/poa`
        );

        // Get contract instance
        const poa = await this.node!.getPOA();
        this.log.info('Stake Contract', poa.address);

        const contract = Contract.load(JSON.parse(poa.abi), poa.address);

        // Call checkStake method
        this.debug('Calling checkStake method');
        const tx = contract.methods.checkStake(
            {
                gas: this.args.options.gas,
                gasPrice: Number(this.args.options.gasPrice)
            },
            utils.cleanAddress(this.args.address)
        );

        // Execute the call
        this.debug('Executing call');
        const response = await this.node!.callTx<Currency>(tx);
        const stakeAmount = response.format('T')

        if (this.args.options.json) {
            return JSON.stringify({
                address: this.args.address,
                stakeAmount
            });
        } else {
            return `Stake amount for ${this.args.address}: ${stakeAmount} BOC`;
        }
    }
}

export const StakeCheck = StakeCheckCommand;