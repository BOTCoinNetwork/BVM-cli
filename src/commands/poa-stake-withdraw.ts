import * as fs from 'fs';
import Inquirer from 'inquirer';
import Vorpal from 'vorpal';
import Node, { Contract } from 'evm-lite-core';
import utils, { Currency } from 'evm-lite-utils';
import color from '../core/color';
import Session from '../core/Session';
import Command, { Arguments, TxOptions } from '../core/TxCommand';

type Opts = TxOptions & {
    interactive?: boolean;
    host: string;
    port: number;
    pwd?: string;
    from: string;
};

type Args = Arguments<Opts> & {
    address: string;
};

type Answers = {
    address: string;
};

export default (evmlc: Vorpal, session: Session) => {
    const description = 'Query stake amount for a specific address';

    return evmlc
        .command('stake check [address]')
        .alias('s c')
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
                new StakeCheckCommand(session, args).run()
        );
};

class StakeCheckCommand extends Command<Args> {
    protected async init(): Promise<boolean> {
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

        this.args.options.from =
            this.args.options.from || this.config.defaults.from;

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
        if (utils.trimHex(this.args.address).length !== 40) {
            throw Error('Invalid address format');
        }

        if (!this.account) {
            if (!this.args.options.from) {
                throw Error('No `from` moniker provided or set in config.');
            }

            if (!this.passphrase) {
                if (!this.args.options.pwd) {
                    throw Error('Passphrase file path not provided.');
                }

                if (!utils.exists(this.args.options.pwd)) {
                    throw Error(
                        'Passphrase file path provided does not exist.'
                    );
                }

                if (utils.isDirectory(this.args.options.pwd)) {
                    throw Error(
                        'Passphrase file path provided is a directory.'
                    );
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

        color.yellow(
            `from: ${this.args.options.from}`
        );

        this.debug('Calling checkStake method');
        const tx = contract.methods.checkStake(
            {
                from: this.account!.address,
                gas: this.args.options.gas,
                gasPrice: Number(this.args.options.gasPrice)
            },
            utils.cleanAddress(this.args.address)
        );

        color.yellow(JSON.stringify(tx, null, 2));

        this.debug('Executing call');
        const response = await this.node!.callTx<Currency>(tx);
        const stakeAmount = response.format('T');

        if (this.args.options.json) {
            return JSON.stringify({
                address: this.args.address,
                stakeAmount: stakeAmount
            });
        } else {
            return `Stake amount for ${this.args.address}: ${stakeAmount} BOC`;
        }
    }
}

export const StakeCheck = StakeCheckCommand;