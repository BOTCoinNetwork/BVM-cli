import Vorpal from 'vorpal';
import Node, { Contract } from 'evm-lite-core';
import Session from '../core/Session';
import Table from '../core/Table';
import Command, { Arguments, TxOptions } from '../core/TxCommand';

type Opts = TxOptions & {
    host: string;
    port: number;
    gas: number;
};

type Args = Arguments<Opts> & {};

export type StakeEntry = {
    addr: string;
    rate: string;
};

export default (evmlc: Vorpal, session: Session) => {
    const description = 'Query current stake list';

    return evmlc
        .command('stake list')
        .alias('s l')
        .description(description)
        .option('-h, --host <ip>', 'override default host')
        .option('-p, --port <port>', 'override default port')
        .option('--gas <g>', 'override default gas value')
        .types({
            string: ['host', 'h']
        })
        .action(
            (args: Args): Promise<void> =>
                new StakeListCommand(session, args).run()
        );
};

class StakeListCommand extends Command<Args> {
    public async init(): Promise<boolean> {
        this.constant = true;

        this.args.options.host =
            this.args.options.host || this.config.connection.host;
        this.args.options.port =
            this.args.options.port || this.config.connection.port;

        if (!this.args.options.gas && this.args.options.gas !== 0) {
            this.args.options.gas = this.config.defaults.gas;
        }

        this.node = new Node(this.args.options.host, this.args.options.port);

        return false;
    }

    protected async prompt(): Promise<void> {
        return;
    }

    protected async check(): Promise<void> {
        return;
    }

    protected async exec(): Promise<string> {
        this.log.http(
            'GET',
            `${this.args.options.host}:${this.args.options.port}/poa`
        );

        const poa = await this.node!.getPOA();
        this.log.info('Stake Contract', poa.address);

        const contract = Contract.load(JSON.parse(poa.abi), poa.address);

        this.debug('Calling checkStakeList');
        const response = await contract.methods.checkStakeList({
            gas: this.args.options.gas,
            gasPrice: Number(this.args.options.gasPrice)
        });

        const result = await this.node!.callTx<String>(response);
        const stakeList = JSON.parse(result.toString());

        if (!stakeList.addrs || !stakeList.addrs.length) {
            return 'No stake records found';
        }

        const table = new Table(['Address', 'Stake Rate']);

        for (const entry of stakeList.addrs) {
            table.push([entry.addr, entry.rate]);
        }

        if (this.args.options.json) {
            return JSON.stringify(stakeList);
        } else {
            return table.toString();
        }
    }
}

export const StakeList = StakeListCommand;