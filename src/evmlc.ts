#!/usr/bin/env node

import { osdatadir } from 'evm-lite-datadir';

// commands
import accountsCreate from './commands/accounts-create';
import accountsGenerate from './commands/accounts-generate';
import accountsGet from './commands/accounts-get';
import accountsImport from './commands/accounts-import';
import accountsInspect from './commands/accounts-inspect';
import accountsList from './commands/accounts-list';
import accountsUpdate from './commands/accounts-update';

import configSet from './commands/config-set';
import configView from './commands/config-view';

import poaCheck from './commands/poa-check';
import poaEvicteeList from './commands/poa-evictee-list';
import poaEvicteeNew from './commands/poa-evictee-new';
import poaEvicteeVote from './commands/poa-evictee-vote';
import poaInit from './commands/poa-init';
import poaNomineeList from './commands/poa-nominee-list';
import poaNomineeNew from './commands/poa-nominee-new';
import poaNomineeVote from './commands/poa-nominee-vote';
import poaWhitelist from './commands/poa-whitelist';

import stake from './commands/poa-stake';
import stakeCheck from './commands/poa-stake-check';
import stakeList from './commands/poa-stake-list';
import stakWithdraw from './commands/poa-stake-withdraw';

import info from './commands/info';
import transfer from './commands/transfer';
import version from './commands/version';

import init, { CLIOptions } from './core/cli';

const options: CLIOptions = {
	name: 'EVMLC',
	delimiter: 'evmlc',
	datadir: osdatadir('evmlite'),
	config: 'evmlc'
};

const commands = [
	info,

	configSet,
	configView,

	accountsList,
	accountsGet,
	accountsCreate,
	accountsUpdate,
	accountsImport,
	accountsInspect,
	accountsGenerate,

	transfer,

	poaInit,
	poaWhitelist,
	poaCheck,

	poaNomineeList,
	poaNomineeNew,
	poaNomineeVote,

	poaEvicteeList,
	poaEvicteeNew,
	poaEvicteeVote,
	stake,
	stakeList,
	stakeCheck,
	stakWithdraw,
	
	version
];

init(options, commands).catch(console.log);
